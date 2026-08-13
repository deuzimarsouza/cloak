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

    for (let index = 0; index < frameCount; index += 1) {
      const dry = input?.[index] || 0;
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
}

registerProcessor("cloak-voice-effects", CloakVoiceEffectsProcessor);
