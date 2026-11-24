'use strict'

async function startAccounts(config) {
  const sdk = 'https://www.gstatic.com/firebasejs/12.4.0/'
  const [app, authApi, dbApi] = await Promise.all([
    import(sdk + 'firebase-app.js'), import(sdk + 'firebase-auth.js'), import(sdk + 'firebase-firestore.js')
  ])
  const firebase = app.initializeApp(config)
  const auth = authApi.getAuth(firebase)
  const db = dbApi.getFirestore(firebase)
  const account = $('account')
  const status = text => { $('sync-status').textContent = text; account.title = text }
  const shell = document.querySelector('.shell')
  let session = null

  function display(snapshot) {
    $('editor').close()
    $('message').value = ''
    $('notifications').hidden = true
    busy.clear()
    state = snapshot
    day = selectedDay()
    render()
  }

  async function flush(s) {
    if (s.writing || !s.pending || session !== s || s.conflict) return
    s.writing = true
    try {
      while (s.pending && session === s) {
        const payload = s.pending
        const revision = s.revision
        status('Salvando…')
        await dbApi.runTransaction(db, async tx => {
          const saved = await tx.get(s.ref)
          if ((saved.data()?.revision || 0) !== revision) {
            s.conflict = true
            throw new Error('conflito')
          }
          tx.set(s.ref, { payload, revision: revision + 1 })
        })
        if (session !== s) return
        s.revision++
        if (s.pending === payload) {
          localStorage.removeItem(s.draft)
          s.pending = null
        } else {
          localStorage.setItem(s.draft, JSON.stringify({revision:s.revision, payload:s.pending}))
        }
      }
      if (session === s) status('Sincronizado')
    } catch {
      if (session === s) status(s.conflict ? 'Conflito · abra a conta' : 'Envio pendente · abra a conta')
    } finally { s.writing = false }
  }

  function queue(s, payload) {
    s.pending = payload
    try { localStorage.setItem(s.draft, JSON.stringify({revision:s.revision, payload})) }
    catch { toast('O navegador não conseguiu guardar a cópia pendente.') }
    void flush(s)
  }

  function menu() {
    const s = session
    if (!s) {
      authApi.signInWithPopup(auth, new authApi.GoogleAuthProvider()).catch(() => toast('Entrada não concluída. Confira a janela de login e tente novamente.'))
      return
    }
    const dialog = $('editor')
    const dismiss = () => dialog.close()
    const content = node('div','')
    content.append(node('h2','','Minha conta'), node('p','',auth.currentUser?.email || 'Conta Google'),
      node('p','',$('sync-status').textContent))
    if (s.pending) {
      content.append(button('Baixar cópia das alterações','action',()=>{
        const url = URL.createObjectURL(new Blob([s.pending], {type:'application/json'}))
        const link = document.createElement('a')
        link.href = url; link.download = 'assistente-alteracoes.json'; link.click()
        setTimeout(()=>URL.revokeObjectURL(url),1000)
      }))
    }
    if (s.conflict) {
      content.append(node('p','','Outro dispositivo alterou a conta. Você pode baixar sua cópia antes de abrir a versão da nuvem.'),
        button('Descartar alterações deste dispositivo','action',()=>{
          if (!confirm('Descartar as alterações pendentes desta aba e abrir a versão da nuvem?')) return
          localStorage.removeItem(s.draft)
          location.reload()
        }))
    } else {
      content.append(button(s.pending ? 'Tentar enviar' : 'Atualizar dados','action',()=>{
        dismiss()
        if (s.pending) void flush(s)
        else location.reload()
      }))
    }
    content.append(button('Sair da conta','action',async ()=>{
      if (s.writing) { toast('Aguarde o envio em andamento.'); return }
      if (s.pending && !confirm('Sair com alterações pendentes? A cópia fica neste navegador para sua próxima entrada.')) return
      await authApi.signOut(auth)
    }), button('Fechar','action',dismiss))
    dialog.replaceChildren(content)
    dialog.showModal()
  }

  account.hidden = false
  account.onclick = menu
  addEventListener('online',()=>{ if(session) void flush(session) })
  authApi.onAuthStateChanged(auth, async user => {
    window.resetCalendar()
    session = null
    accountSave = null
    display(load())
    account.textContent = 'Entrar'
    shell.inert = !!user
    status(user ? 'Abrindo conta…' : 'Neste navegador')
    if (!user) return
    const prefix = key + ':pendente:' + user.uid + ':'
    const draft = prefix + crypto.randomUUID()
    const s = {ref:dbApi.doc(db,'assistentes',user.uid), draft, revision:0, pending:null}
    session = s
    try {
      const saved = await dbApi.getDocFromServer(s.ref)
      if (session !== s) return
      s.revision = saved.data()?.revision || 0
      let snapshot = saved.exists() ? JSON.parse(saved.data().payload) : seed()
      if (!saved.exists() && localStorage.getItem(key) && confirm('Copiar os dados deste navegador para ' + user.email + '?')) snapshot = load()
      // Cada aba mantém seu próprio rascunho, inclusive se outra aba estiver aberta.
      const oldDraft = Object.keys(localStorage).find(k => k.startsWith(prefix))
      if (oldDraft && confirm('Recuperar uma cópia com alterações pendentes desta conta?')) {
        const previous = JSON.parse(localStorage.getItem(oldDraft))
        snapshot = JSON.parse(previous.payload)
        s.pending = previous.payload
        s.conflict = s.revision !== previous.revision
        s.revision = previous.revision
        localStorage.setItem(draft, JSON.stringify(previous))
        localStorage.removeItem(oldDraft)
      }
      display(snapshot)
      accountSave = payload => queue(s, payload)
      window.enableCalendar(user,authApi)
      renderAgenda()
      renderTimeline()
      account.textContent = 'Minha conta'
      status(s.conflict ? 'Conflito · abra a conta' : 'Sincronizado')
      if (!saved.exists() || s.pending) queue(s, JSON.stringify(state))
    } catch {
      if (session !== s) return
      await authApi.signOut(auth)
      toast('Não foi possível abrir os dados da conta. Confira a conexão e a configuração do Firebase.')
    } finally { if (session === s) shell.inert = false }
  })
}

if (window.assistantFirebaseConfig) {
  startAccounts(window.assistantFirebaseConfig).catch(() => toast('Login indisponível. Tente recarregar a página.'))
}
