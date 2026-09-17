# Cloak

## Interface Studio — atualização de 16/09/2026

O projeto recebeu uma interface inspirada em streaming e conversa em grupo: tema escuro com detalhes em violeta, navegação lateral, uma nova tela de entrada, palco de transmissão, participantes em uma faixa própria e chat lateral com balões de mensagem. No celular, os painéis são empilhados; ao focar o campo de mensagem, o chat ganha espaço.

- `studio.css` concentra o novo visual e os ajustes responsivos.
- `studio.js` conecta os atalhos visuais aos controles existentes e abre a ajuda.
- A ilustração da página inicial é identificada como prévia; não representa pessoas ou transmissões conectadas.
- O nome e o estado de conexão da sala aparecem no novo cabeçalho.
- O cache da PWA inclui os novos arquivos e uma nova versão.
- A lógica de salas, convites e voz foi mantida. O compartilhamento agora também transporta áudio isolado, conforme descrito abaixo.

**Para atualizar:** envie todo o conteúdo desta pasta para a hospedagem, incluindo `studio.css` e `studio.js`. Feche as abas e janelas antigas do Cloak e abra novamente para permitir a ativação da nova versão da PWA.

**Verificação desta atualização:** sintaxe dos arquivos JavaScript, preservação dos 122 IDs originais, referências locais, vínculos de acessibilidade, integridade do PeerJS e versões do cache. A revisão visual no navegador e chamadas reais entre dispositivos não foram executadas neste ambiente.

O Cloak é um chat de voz com compartilhamento de tela que funciona direto no navegador. Uma pessoa configura e cria a sala, recebe um código automático e compartilha o convite. As demais entram pelo código ou pelo link, e cada permissão de microfone ou tela é solicitada pelo próprio navegador.

## O que já está pronto

- criação de sala com nome e código aleatório de 12 caracteres;
- capacidade configurável de 5, 10, 15, 20, 25 ou 30 pessoas, incluindo o anfitrião;
- permissão definida pelo anfitrião para convidados falarem ou entrarem somente para ouvir;
- remoção de participantes pelo anfitrião;
- convite por código ou URL;
- autorização explícita do microfone somente depois que a sala já está aberta;
- seleção da entrada de áudio durante a conversa;
- equalizador de voz com estilos Natural, Fina, Grave, Robô e Eletrônica;
- teste local com retorno da própria voz e opção de salvar o ajuste como padrão;
- permanência na sala apenas para ouvir quando o microfone não é permitido;
- áudio em tempo real com WebRTC;
- compartilhamento de aba, janela ou tela com o seletor seguro do navegador;
- prévia local, grade para vários apresentadores e encerramento pelo Cloak ou pelo botão nativo do navegador;
- lista de participantes e indicador de quem está falando;
- volume individual e silenciamento local de participantes;
- chat temporário de texto e emojis dentro da sala;
- silenciar/ativar o próprio microfone;
- estados de entrada, saída, conexão e erros;
- limite configurável de até 30 pessoas por sala;
- interface responsiva e acessível;
- instalação como aplicativo (PWA) no computador ou celular;
- abertura da interface sem internet, com aviso claro de que as salas exigem conexão;
- publicação automática no GitHub Pages.

## Correção de entrada por link e código — 16/09/2026

A revisão encontrou uma configuração ICE personalizada que substituía os padrões do PeerJS 1.5.5 e removia seus servidores TURN públicos. O aplicativo agora preserva esses padrões. Isso recupera uma alternativa de conexão entre redes diferentes, mas não comprova a causa exata de uma falha em um dispositivo específico nem garante disponibilidade dos servidores públicos.

Também foram corrigidos:

- timeout de transporte distinguido de sala inexistente; janela de conexão ampliada para 30 segundos;
- encerramento do canal, falha no envio da solicitação e rejeição na confirmação final com tratamento imediato;
- diagnóstico de versões incompatíveis entre anfitrião e convidado;
- leitura de links com código em `#room=` ou `?room=`, inclusive valores codificados;
- preferência pelo código do fragmento quando um link também traz um parâmetro antigo;
- códigos inválidos ou compridos rejeitados, sem remover letras ou truncar até virar outro código;
- convite para outra sala respeitado antes de restaurar a sessão anterior;
- validação dos metadados antes da admissão;
- falha no carregamento do recurso opcional de áudio da tela não derruba a inicialização das salas.

### Aplicar esta atualização

1. Publique **todo o conteúdo** desta pasta, mantendo a estrutura. Não é necessário criar outro repositório.
2. Anfitrião e participantes devem fechar **todas as abas e janelas instaladas do Cloak** e abrir o site novamente para atualizar a PWA. Se ainda aparecer uma versão antiga, limpe os dados do site e reabra.
3. Crie uma sala nova na versão atualizada, mantenha o anfitrião conectado e envie o novo convite.
4. Confira primeiro entre dois dispositivos. Se uma rede falhar, compare com outra (por exemplo Wi-Fi e dados móveis) e anote a mensagem completa de erro.

### O que foi verificado

**27 testes automatizados passaram:** 15 de conexão/admissão e 12 de áudio. Os testes de conexão executam as funções reais de `app.js` em contextos separados de anfitrião/convidado com transporte simulado. Eles cobrem criação, entrada por código/link, sala cheia, canal encerrado, host ausente, timeout, versões diferentes e convites inválidos. Foram conferidos sintaxe JavaScript, recursos locais, IDs únicos, referências de acessibilidade, hash SRI do PeerJS e versões do cache.

Execute todos os testes com `node --test tests/*.test.cjs`.

**Publicação verificada em 17/09/2026:** o GitHub Pages publicou o commit `a76d152e17b70b2ceca779955c6d32f0e8f0054d`, que ainda carregava `app.js?v=13` com configuração somente STUN. O conteúdo era idêntico ao envio anterior. Esta correção usa `app.js?v=14` e atualiza o cache da PWA; ela só chega aos participantes depois de ser publicada e carregada nos dois dispositivos.

**Limite da verificação:** não houve teste real entre navegadores/redes. A conferência da publicação foi feita pelos arquivos do repositório e pelo resultado do workflow do GitHub Pages. TURN público pode estar indisponível, bloqueado ou insuficiente. Para confiabilidade de produção, use um serviço TURN próprio com credenciais temporárias fornecidas por backend; não publique segredos de provedores no JavaScript.

Referência: [PeerJS — limitações de rede e TURN](https://peerjs.com/client/faq).

## Som da transmissão + vozes dos convidados

1. Na sala, clique em **Tela** e deixe marcada a opção **Compartilhar som da transmissão**.
2. Prefira selecionar uma **aba** que reproduza o conteúdo e marque **Compartilhar áudio** no seletor do navegador.
3. Cada convidado clica em **Ouvir transmissão**, abaixo do vídeo. O controle **Volume da tela** altera somente esse conteúdo; o volume das vozes continua nos cartões dos participantes. **Silenciar tela** não silencia os convidados.

Quem apresenta continua ouvindo o conteúdo na fonte original. A prévia local do Cloak fica sempre muda, sem retorno duplicado. Cada transmissão recebida reproduz som em um único elemento de vídeo; não há uma segunda saída de áudio nem mistura com o microfone. O áudio de tela não passa pelo equalizador de voz.

O som geral do computador pode incluir as vozes da própria chamada. Por isso, ele só é solicitado quando o navegador oferece `restrictOwnAudio`; o áudio de janela/tela só é encaminhado se a configuração da trilha confirmar esse isolamento. Sem essa confirmação, a imagem continua, mas o som é descartado e o Cloak avisa para compartilhar uma aba. A aba atual é excluída do seletor quando o navegador suporta essa opção; abas Cloak identificadas por Capture Handle também têm o áudio recusado. Para trocar de fonte com som, encerre e inicie o compartilhamento novamente.

O suporte à captura de áudio varia por navegador, fonte e sistema operacional. Use fones para reduzir o som dos alto-falantes recapturado pelo microfone: cancelamento de eco já está ativo, mas nenhum aplicativo garante eliminar todo retorno acústico. A origem compartilhada deve ser o conteúdo, não outra instância da mesma chamada.

**Atualização necessária para todos:** quem transmite e quem assiste deve carregar esta versão. Versões anteriores descartavam o áudio recebido da tela. Feche as abas/janelas antigas da PWA e reabra após publicar todos os arquivos.

**Validação:** 12 testes automatizados em `tests/screen-audio.test.cjs` verificam isolamento, saída única, independência do volume, bloqueio de autoplay, prévia local, trilhas adicionadas/removidas, troca de stream e descarte de callbacks antigos. Execute `node --test tests/screen-audio.test.cjs`. São testes com mídia simulada; ainda é necessário conferir a reprodução real entre dois dispositivos e a aparência no navegador.

Referências técnicas: [controles de compartilhamento](https://developer.chrome.com/docs/web-platform/screen-sharing-controls), [restrictOwnAudio](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/restrictOwnAudio), [Capture Handle](https://developer.chrome.com/docs/web-platform/capture-handle).

## Executar localmente

O projeto não precisa de instalação ou compilação. Sirva a pasta com qualquer servidor HTTP local. Um exemplo, caso você tenha Python instalado:

```bash
python -m http.server 8080
```

Depois abra `http://localhost:8080`. Não abra apenas o arquivo `index.html` com dois cliques: o navegador pode limitar recursos de rede, microfone e compartilhamento de tela nesse modo.

## Instalar pelo navegador

O Cloak publicado pode ser instalado como aplicativo, sem baixar um instalador:

1. Abra [https://deuzimarsouza.github.io/cloak/](https://deuzimarsouza.github.io/cloak/) no Chrome ou Edge.
2. Aguarde o botão **Instalar Cloak** aparecer no cabeçalho e selecione-o. Você também pode usar o ícone de instalação na barra de endereço ou a opção **Instalar aplicativo** no menu do navegador.
3. Confirme a instalação. O Cloak passará a abrir em uma janela própria e poderá ser iniciado pelo menu de aplicativos do sistema.

No Safari para macOS, use **Arquivo → Adicionar ao Dock**. No iPhone ou iPad, use **Compartilhar → Adicionar à Tela de Início**. O Firefox para computador não oferece instalação PWA por manifesto.

A interface e os recursos visuais ficam disponíveis offline após a primeira visita. Criar, entrar ou conversar em uma sala continua exigindo internet porque a sinalização do PeerJS e as conexões WebRTC são serviços de rede.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos para a branch `main`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch** como fonte.
4. Escolha a branch `main`, a pasta `/ (root)` e salve. Cada envio para `main` atualizará o site.

O endereço terá o formato `https://seu-usuario.github.io/nome-do-repositorio/`. O GitHub Pages usa HTTPS, requisito do navegador para liberar o microfone e a captura de tela.

## Como a conexão funciona

O site é totalmente estático e pode ficar no GitHub Pages. Para que os navegadores se encontrem, ele usa o PeerJS Cloud como serviço de sinalização. Depois da conexão, áudio e telas trafegam por WebRTC diretamente entre os participantes e não são gravados pelo Cloak. As mensagens do chat ficam apenas na sessão temporária do navegador para permitir a recuperação após uma atualização da página; não usam banco de dados e são apagadas quando o anfitrião encerra a sala.

Isso não torna a conexão anônima: PeerJS Cloud e os servidores STUN recebem os metadados de rede necessários para estabelecer a chamada, e participantes WebRTC podem receber informações de conectividade. Não use o Cloak como ferramenta de anonimato; o código da sala funciona somente como chave de acesso ao convite.

Ao clicar em **Tela**, o Cloak permite escolher 480p, 720p ou 1080p e limitar a transmissão a 30 ou 60 FPS antes de abrir o seletor nativo do navegador. O padrão é 720p a 30 FPS, que equilibra nitidez e estabilidade. Esses valores são tetos: a fonte, o navegador, o processador ou a conexão podem entregar menos. Durante congestionamento, o envio reduz bitrate, FPS e resolução gradualmente até o perfil de 480p, recuperando qualidade somente depois que a conexão estabiliza.

Por segurança, o Cloak não consegue listar as abas, janelas ou telas disponíveis nem memorizar a permissão de captura. Uma atualização da página ou saída da sala encerra a transmissão e exige uma nova escolha do usuário.

O criador da sala funciona como coordenador. Se ele atualizar a página ou perder a conexão por alguns instantes, o Cloak tenta recuperar a mesma sala durante uma janela curta. Se o anfitrião clicar em **Sair**, a sala termina imediatamente; se fechar a aba e não retornar, os convidados veem a tentativa de reconexão antes de a sala expirar. O código é a chave de acesso: compartilhe-o apenas com quem deve participar.

## Limites deste MVP

- O PeerJS Cloud é um serviço público compartilhado, adequado para protótipos, sem garantia de disponibilidade para um produto comercial.
- A configuração preserva STUN e os relays TURN públicos incluídos no PeerJS 1.5.5. A disponibilidade deles não é garantida; redes restritas ainda podem impedir a conexão. Confiabilidade de produção exige TURN próprio com credenciais temporárias.
- A sala usa uma malha de conexões entre os navegadores. O limite lógico é de 30 pessoas, mas muitas vozes simultâneas podem sobrecarregar CPU e upload; estabilidade garantida em grupos grandes exige uma SFU como LiveKit, Jitsi, Janus ou mediasoup.
- Cada tela compartilhada também é enviada uma vez para cada participante. O Cloak divide um orçamento de upload entre essas cópias para reduzir congestionamento, mas salas grandes ainda devem preferir 480p ou 720p a 30 FPS; um produto de escala deve encaminhar vídeo por uma SFU.
- A remoção encerra e bloqueia a reconexão automática daquela sessão. Sem contas ou backend, ela não funciona como banimento permanente: alguém com o convite pode tentar entrar novamente em uma nova sessão.
- Não há contas, moderação persistente nem recuperação da sala após a saída definitiva do criador.
- Nunca coloque chaves secretas ou credenciais TURN permanentes no JavaScript publicado.

## Estrutura

```text
index.html                    interface e conteúdo
styles.css                    estilos e estados originais
studio.css                    nova interface Studio e responsividade
studio.js                     atalhos da interface e ajuda
screen-audio.js               isolamento da captura e saída única de som
tests/screen-audio.test.cjs    testes automatizados com mídia simulada
tests/connection.test.cjs      testes do protocolo com transporte simulado
app.js                        salas, microfone, WebRTC e estados
pwa.js                        instalação e registro do service worker
manifest.webmanifest          identidade e configuração do aplicativo
service-worker.js             cache do shell e abertura offline
voice-effects-processor.js    processamento dos efeitos de voz em tempo real
vendor/peerjs.min.js          PeerJS 1.5.5 fixado e servido pelo próprio site
vendor/peerjs.LICENSE.txt     licença MIT da dependência vendorizada
src/icons/icon-*.png          ícones de instalação normal e maskable
```

## Manutenção da PWA

O arquivo vendorizado veio da [versão 1.5.5 oficial do PeerJS](https://github.com/peers/peerjs/releases/tag/v1.5.5). Seu SHA-384 em Base64 é `x0YgkOr/3UOZP2CRDxGW9e0Q+2Qjyr3uJrm4xU32Y7ZCNAo7Cc7bjhrZMi/dwczu`, igual ao atributo `integrity` usado pelo HTML. Ao atualizar a dependência, atualize o arquivo, o hash, a versão da URL e a licença.

Sempre que um recurso listado em `APP_SHELL` mudar, incremente `CACHE_VERSION` em `service-worker.js` e sincronize a versão da URL no arquivo que consome o recurso e na entrada correspondente de `APP_SHELL`. Cada release deve usar um cache novo para que uma chamada aberta nunca misture arquivos de versões diferentes.

## Navegadores

Use versões recentes do Chrome, Edge, Firefox ou Safari. Chrome e Edge oferecem a experiência de instalação mais direta no computador; no Safari, use a opção de adicionar ao Dock ou à Tela de Início. A lista de abas e janelas disponíveis varia conforme o navegador e o sistema operacional; aparelhos móveis podem não oferecer captura de tela. Para testar uma conversa de verdade, abra o endereço em dois dispositivos ou em dois perfis separados do navegador para que cada participante tenha uma sessão própria.
