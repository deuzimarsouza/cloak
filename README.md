# Cloak

O Cloak é um chat de voz para salas pequenas que funciona direto no navegador. Uma pessoa cria a sala, recebe um código automático e compartilha o convite. As demais entram pelo código ou pelo link e o navegador pede autorização antes de usar o microfone.

## O que já está pronto

- criação de sala com código aleatório de 12 caracteres;
- convite por código ou URL;
- autorização explícita do microfone;
- seleção da entrada de áudio antes e durante a conversa;
- equalizador de voz com estilos Natural, Fina, Grave, Robô e Eletrônica;
- teste local com retorno da própria voz e opção de salvar o ajuste como padrão;
- opção de entrar apenas para ouvir;
- áudio em tempo real com WebRTC;
- lista de participantes e indicador de quem está falando;
- volume individual e silenciamento local de participantes;
- chat temporário de texto e emojis dentro da sala;
- silenciar/ativar o próprio microfone;
- estados de entrada, saída, conexão e erros;
- limite de 6 pessoas por sala;
- interface responsiva e acessível;
- publicação automática no GitHub Pages.

## Executar localmente

O projeto não precisa de instalação ou compilação. Sirva a pasta com qualquer servidor HTTP local. Um exemplo, caso você tenha Python instalado:

```bash
python -m http.server 8080
```

Depois abra `http://localhost:8080`. Não abra apenas o arquivo `index.html` com dois cliques: o navegador pode limitar recursos de rede e de microfone nesse modo.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos para a branch `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, selecione **GitHub Actions** como fonte.
4. O fluxo incluído em `.github/workflows/pages.yml` publicará o site automaticamente a cada envio para `main`.

O endereço terá o formato `https://seu-usuario.github.io/nome-do-repositorio/`. O GitHub Pages usa HTTPS, requisito do navegador para liberar o microfone.

## Como a conexão funciona

O site é totalmente estático e pode ficar no GitHub Pages. Para que os navegadores se encontrem, ele usa o PeerJS Cloud como serviço de sinalização. Depois da conexão, o áudio trafega por WebRTC diretamente entre os participantes e não é gravado pelo Cloak. As mensagens do chat ficam apenas na sessão temporária do navegador para permitir a recuperação após uma atualização da página; não usam banco de dados e são apagadas quando o anfitrião encerra a sala.

O criador da sala funciona como coordenador. Por isso, se ele fechar a aba ou sair, a sala termina para todos. O código é a chave de acesso: compartilhe-o apenas com quem deve participar.

## Limites deste MVP

- O PeerJS Cloud é um serviço público compartilhado, adequado para protótipos, sem garantia de disponibilidade para um produto comercial.
- A configuração usa STUN público. Algumas redes corporativas, redes móveis restritas e NATs simétricos podem impedir o áudio. Confiabilidade de produção exige um servidor TURN com credenciais temporárias.
- A sala usa uma malha de conexões entre os navegadores; por isso o limite é de 6 pessoas. Para grupos maiores, use uma SFU como LiveKit, Jitsi, Janus ou mediasoup.
- Não há contas, moderação persistente nem recuperação da sala após a saída do criador.
- Nunca coloque chaves secretas ou credenciais TURN permanentes no JavaScript publicado.

## Estrutura

```text
index.html                    interface e conteúdo
styles.css                    identidade visual e responsividade
app.js                        salas, microfone, WebRTC e estados
voice-effects-processor.js    processamento dos efeitos de voz em tempo real
.github/workflows/pages.yml   publicação automática no GitHub Pages
```

## Navegadores

Use versões recentes do Chrome, Edge, Firefox ou Safari. Para testar uma conversa de verdade, abra o endereço em dois dispositivos ou em dois perfis separados do navegador para que cada participante tenha uma sessão e um microfone próprios.
