"use strict";

const TWO_PI = Math.PI * 2;
const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

class CloakVoiceEffectsProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "pitchSemitones",
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: "k-rate",
      },
      {
        name: "robotAmount",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "robotFrequency",
        defaultValue: 45,
        minValue: 20,
        maxValue: 120,
        automationRate: "k-rate",
      },
      {
        name: "electronicAmount",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "effectMix",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "outputGain",
        defaultValue: 0.9,
        minValue: 0.25,
        maxValue: 1.25,
        automationRate: "k-rate",
      },
      {
        name: "isolationAmount",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.grainSpan = Math.max(256, Math.round(sampleRate * 0.042));
    this.minimumDelay = Math.max(8, Math.round(sampleRate * 0.006));
    this.ring = new Float32Array(this.grainSpan + this.minimumDelay + 8);
    this.writeIndex = 0;
    this.grainPhase = 0;
    this.robotPhase = 0;
    this.holdPhase = 1;
    this.heldSample = 0;
    this.pitchWet = 0;
    this.mix = 1;
    this.smoothing = 1 - Math.exp(-1 / (sampleRate * 0.012));
    this.isolationMix = 0;
    this.isolationGain = 1;
    this.isolationSmoothing = 1 - Math.exp(-1 / (sampleRate * 0.025));
    this.gateAttack = 1 - Math.exp(-1 / (sampleRate * 0.0025));
    this.gateRelease = 1 - Math.exp(-1 / (sampleRate * 0.18));
    this.previousDetectorSample = 0;
    this.resetNoiseProfile();
    this.port.onmessage = (event) => {
      if (event.data?.type === "reset-noise-profile") {
        this.resetNoiseProfile();
      }
    };
  }

  resetNoiseProfile() {
    this.noiseFloor = 0.004;
    this.noiseWindowMinimum = Number.POSITIVE_INFINITY;
    this.noiseWindowSamples = 0;
    this.noiseWindowEligibleSamples = 0;
    this.noiseWindowSpan = Math.max(128, Math.round(sampleRate * 0.75));
    this.calibrationSamplesRemaining = Math.round(sampleRate * 0.35);
    this.calibrationSum = 0;
    this.calibrationBlocks = 0;
    this.gateHoldSamples = 0;
    this.gateHoldSpan = Math.round(sampleRate * 0.16);
    this.gateTarget = 1;
    this.energyEnvelopeSquared = 0;
    this.stationaryLevel = 0;
    this.stationaryDeviation = 0;
    this.longTermZeroCrossingRate = 0;
    this.stationaryStatisticsSamples = 0;
    this.stationaryToneSamples = 0;
    this.stationaryToneSpan = Math.round(sampleRate * 1.2);
    this.previousDetectorSample = 0;
  }

  readDelay(delayInSamples) {
    let position = this.writeIndex - delayInSamples;
    while (position < 0) position += this.ring.length;
    const first = Math.floor(position);
    const fraction = position - first;
    const second = first + 1 === this.ring.length ? 0 : first + 1;
    return this.ring[first] + (this.ring[second] - this.ring[first]) * fraction;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]?.[0];
    const output = outputs[0];
    if (!output?.length) return true;

    const frameCount = output[0].length;
    const semitones = clamp(parameters.pitchSemitones[0] || 0, -12, 12);
    const ratio = 2 ** (semitones / 12);
    const grainPhaseStep = (1 - ratio) / this.grainSpan;
    const pitchWetTarget = clamp(Math.abs(semitones) / 0.25, 0, 1);
    const robot = clamp(parameters.robotAmount[0] || 0, 0, 1);
    const robotFrequency = clamp(parameters.robotFrequency[0] || 45, 20, 120);
    const robotPhaseStep = (TWO_PI * robotFrequency) / sampleRate;
    const electronic = clamp(parameters.electronicAmount[0] || 0, 0, 1);
    const holdIncrement = 1 - electronic * 0.82;
    const bits = Math.round(16 - electronic * 10);
    const quantizationLevels = 2 ** (bits - 1);
    const drive = 1 + electronic * 2.5;
    const driveNormalization = Math.tanh(drive) || 1;
    const mixTarget = clamp(parameters.effectMix[0] ?? 1, 0, 1);
    const outputGain = clamp(parameters.outputGain[0] ?? 0.9, 0.25, 1.25);
    const isolationTarget = clamp(parameters.isolationAmount[0] ?? 1, 0, 1);

    // O detector trabalha por bloco para não criar objetos no caminho de áudio.
    let sumSquares = 0;
    let zeroCrossings = 0;
    let previousDetectorSample = this.previousDetectorSample;
    for (let index = 0; index < frameCount; index += 1) {
      const sample = input?.[index] || 0;
      sumSquares += sample * sample;
      if ((sample >= 0) !== (previousDetectorSample >= 0)) zeroCrossings += 1;
      previousDetectorSample = sample;
    }
    this.previousDetectorSample = previousDetectorSample;
    const blockRms = Math.sqrt(sumSquares / Math.max(1, frameCount));
    const zeroCrossingRate = zeroCrossings / Math.max(1, frameCount);
    this.updateNoiseEstimate(
      blockRms,
      zeroCrossingRate,
      frameCount,
      isolationTarget,
    );
    this.updateGateTarget(
      blockRms,
      zeroCrossingRate,
      frameCount,
      isolationTarget,
    );

    for (let index = 0; index < frameCount; index += 1) {
      const raw = input?.[index] || 0;
      this.isolationMix +=
        (isolationTarget - this.isolationMix) * this.isolationSmoothing;
      const gateSmoothing =
        this.gateTarget > this.isolationGain
          ? this.gateAttack
          : this.gateRelease;
      this.isolationGain +=
        (this.gateTarget - this.isolationGain) * gateSmoothing;
      const appliedIsolationGain =
        1 + (this.isolationGain - 1) * this.isolationMix;
      const dry = raw * appliedIsolationGain;
      this.ring[this.writeIndex] = dry;

      const phaseA = this.grainPhase;
      let phaseB = phaseA + 0.5;
      if (phaseB >= 1) phaseB -= 1;
      const windowA = 0.5 - 0.5 * Math.cos(TWO_PI * phaseA);
      const windowB = 1 - windowA;
      const grainA = this.readDelay(
        this.minimumDelay + phaseA * this.grainSpan,
      );
      const grainB = this.readDelay(
        this.minimumDelay + phaseB * this.grainSpan,
      );
      const shifted = grainA * windowA + grainB * windowB;

      this.pitchWet += (pitchWetTarget - this.pitchWet) * this.smoothing;
      let effected = dry + (shifted - dry) * this.pitchWet;

      const carrier = Math.sin(this.robotPhase);
      const ringModulated = effected * carrier * 1.3;
      effected += (ringModulated - effected) * robot;

      this.holdPhase += holdIncrement;
      if (this.holdPhase >= 1) {
        this.holdPhase -= Math.floor(this.holdPhase);
        this.heldSample = effected;
      }
      const quantized =
        Math.round(this.heldSample * quantizationLevels) / quantizationLevels;
      const electronicSignal =
        Math.tanh(quantized * drive) / driveNormalization;
      effected += (electronicSignal - effected) * electronic;

      this.mix += (mixTarget - this.mix) * this.smoothing;
      const sample = clamp(
        (dry + (effected - dry) * this.mix) * outputGain,
        -1.2,
        1.2,
      );
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel][index] = sample;
      }

      this.writeIndex += 1;
      if (this.writeIndex === this.ring.length) this.writeIndex = 0;
      this.grainPhase += grainPhaseStep;
      if (this.grainPhase >= 1) {
        this.grainPhase -= Math.floor(this.grainPhase);
      } else if (this.grainPhase < 0) {
        this.grainPhase += Math.ceil(-this.grainPhase);
      }
      this.robotPhase += robotPhaseStep;
      if (this.robotPhase >= TWO_PI) this.robotPhase -= TWO_PI;
    }

    return true;
  }

  updateNoiseEstimate(
    blockRms,
    zeroCrossingRate,
    frameCount,
    isolationAmount,
  ) {
    if (isolationAmount <= 0) return;
    const measured = clamp(blockRms, 0.00001, 0.12);
    this.noiseWindowSamples += frameCount;
    // Ruído amplo cruza o zero com frequência; voz tonal fica fora do aprendizado.
    const likelyNoise = measured < 0.0035 || zeroCrossingRate >= 0.11;
    if (likelyNoise) {
      this.noiseWindowMinimum = Math.min(this.noiseWindowMinimum, measured);
      this.noiseWindowEligibleSamples += frameCount;
    }

    if (this.calibrationSamplesRemaining > 0) {
      const likelyVoicedSpeech =
        measured >= 0.0035 && zeroCrossingRate < 0.075;
      if (measured > 0.0002 && measured < 0.04 && !likelyVoicedSpeech) {
        this.calibrationSum += measured;
        this.calibrationBlocks += 1;
      }
      this.calibrationSamplesRemaining = Math.max(
        0,
        this.calibrationSamplesRemaining - frameCount,
      );
      if (this.calibrationSamplesRemaining === 0) {
        if (this.calibrationBlocks > 0) {
          this.noiseFloor = clamp(
            this.calibrationSum / this.calibrationBlocks,
            0.0003,
            0.0085,
          );
        }
        this.noiseWindowMinimum = Number.POSITIVE_INFINITY;
        this.noiseWindowSamples = 0;
        this.noiseWindowEligibleSamples = 0;
      }
      return;
    }

    if (this.noiseWindowSamples < this.noiseWindowSpan) return;
    const candidate = this.noiseWindowMinimum;
    if (Number.isFinite(candidate) && candidate < this.noiseFloor) {
      this.noiseFloor = clamp(
        this.noiseFloor + (candidate - this.noiseFloor) * 0.62,
        0.0003,
        0.0085,
      );
    } else if (
      Number.isFinite(candidate) &&
      this.noiseWindowEligibleSamples >= this.noiseWindowSpan * 0.82
    ) {
      this.noiseFloor = clamp(
        this.noiseFloor + (candidate - this.noiseFloor) * 0.5,
        0.0003,
        0.0085,
      );
    }
    this.noiseWindowMinimum = Number.POSITIVE_INFINITY;
    this.noiseWindowSamples = 0;
    this.noiseWindowEligibleSamples = 0;
  }

  updateGateTarget(
    blockRms,
    zeroCrossingRate,
    frameCount,
    isolationAmount,
  ) {
    if (isolationAmount <= 0 || this.calibrationSamplesRemaining > 0) {
      this.gateTarget = 1;
      this.gateHoldSamples = 0;
      return;
    }

    const openThreshold = Math.max(
      0.0045,
      this.noiseFloor * (1.9 + isolationAmount * 0.25),
    );
    const closeThreshold = Math.max(
      0.0028,
      this.noiseFloor * (1.28 + isolationAmount * 0.12),
    );
    // Um hum baixo e realmente estável recebe atenuação leve; fala fraca não é
    // silenciada apenas por estar abaixo do limiar principal.
    const envelopeSmoothing =
      1 - Math.exp(-frameCount / (sampleRate * 0.03));
    const statisticsSmoothing =
      1 - Math.exp(-frameCount / (sampleRate * 0.55));
    this.energyEnvelopeSquared +=
      (blockRms * blockRms - this.energyEnvelopeSquared) *
      envelopeSmoothing;
    const energyEnvelope = Math.sqrt(
      Math.max(0, this.energyEnvelopeSquared),
    );
    this.stationaryLevel +=
      (energyEnvelope - this.stationaryLevel) * statisticsSmoothing;
    this.stationaryDeviation +=
      (Math.abs(energyEnvelope - this.stationaryLevel) -
        this.stationaryDeviation) *
      statisticsSmoothing;
    this.longTermZeroCrossingRate +=
      (zeroCrossingRate - this.longTermZeroCrossingRate) *
      statisticsSmoothing;
    this.stationaryStatisticsSamples = Math.min(
      sampleRate,
      this.stationaryStatisticsSamples + frameCount,
    );
    const relativeDeviation =
      this.stationaryDeviation / Math.max(0.0001, this.stationaryLevel);
    const lowStationaryTone =
      this.stationaryStatisticsSamples >= sampleRate * 0.6 &&
      this.stationaryLevel >= 0.0015 &&
      this.stationaryLevel <= 0.0062 &&
      this.longTermZeroCrossingRate < 0.0065 &&
      relativeDeviation < 0.09;
    this.stationaryToneSamples = lowStationaryTone
      ? Math.min(
          this.stationaryToneSpan,
          this.stationaryToneSamples + frameCount,
        )
      : 0;
    const suppressStationaryTone =
      this.stationaryToneSamples >= this.stationaryToneSpan;
    if (suppressStationaryTone) {
      this.gateHoldSamples = 0;
      this.gateTarget = 10 ** ((-8 * isolationAmount) / 20);
      return;
    }
    const likelyVoicedSpeech =
      zeroCrossingRate < 0.09 &&
      blockRms >= closeThreshold * 0.78;

    if (blockRms >= openThreshold || likelyVoicedSpeech) {
      this.gateHoldSamples = this.gateHoldSpan;
      this.gateTarget = 1;
      return;
    }

    if (this.gateHoldSamples > 0) {
      this.gateHoldSamples = Math.max(0, this.gateHoldSamples - frameCount);
      this.gateTarget = 1;
      return;
    }

    const range = Math.max(0.00001, openThreshold - closeThreshold);
    const position = clamp((blockRms - closeThreshold) / range, 0, 1);
    const smoothPosition = position * position * (3 - 2 * position);
    const minimumGain = 10 ** ((-26 * isolationAmount) / 20);
    this.gateTarget =
      minimumGain + (1 - minimumGain) * smoothPosition;
  }
}

registerProcessor("cloak-voice-effects", CloakVoiceEffectsProcessor);
