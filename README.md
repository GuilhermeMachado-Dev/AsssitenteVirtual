# Assistente IA

## Ativar a conta pessoal

1. No console Firebase, crie um projeto e registre um aplicativo **Web**. Copie o objeto público de configuração para `firebase-config.js` como valor de `window.assistantFirebaseConfig`.
2. Em **Authentication**, habilite o provedor **Google** e inclua `guilhermemachado-dev.github.io` nos domínios autorizados.
3. Crie o banco padrão do **Cloud Firestore** em modo de produção. Na aba de regras, publique o conteúdo de `firestore.rules`. Cada pessoa autenticada pode ler e alterar apenas seu próprio documento.
4. Publique os arquivos do site pelo mesmo GitHub Pages. O botão **Entrar** aparece quando a configuração está preenchida. No primeiro acesso a uma conta vazia, o painel oferece copiar os dados locais. Se já houver dados na conta, abre a cópia da nuvem e mantém os dados originais do navegador no modo local.
5. Para validar, crie uma atividade com checklist no primeiro dispositivo, aguarde **Sincronizado**, entre com a mesma conta em outro navegador e abra a atividade. Para reler os dados em uma sessão que já estava aberta, use **Minha conta → Atualizar dados**.

Cada gravação verifica a revisão da conta. Se outro dispositivo tiver salvado primeiro, o painel mantém o rascunho e oferece baixá-lo antes de abrir a versão da nuvem. Esta versão armazena um documento por conta, limitado pelas regras a 900 mil caracteres para o conteúdo serializado. As credenciais administrativas não fazem parte do site.
