'use strict'

const $ = (id) => document.getElementById(id)
const key = 'assistente-ia-v1'
const modes = {
  estudos: {name:'Estudos', context:'Estudo de Front-end', skills:['Programação','IA','Nutrição','Automações'], tagline:'Foco, compreensão e aprendizado contínuo.', quick:['Me explica','Planejar sessão']},
  projetos: {name:'Projetos', context:'Conteúdo Digital', skills:['Conteúdo','Automações','Programação','IA'], tagline:'Da primeira ideia à entrega do projeto.', quick:['Planejar entrega','Próximo passo']},
}
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const dateOf = (day) => new Date(`${day}T12:00:00`)
const dateLabel = (day) => new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(dateOf(day))
const mins = (value) => Number(value.slice(0,2))*60+Number(value.slice(3))
const clockText = (minutes) => `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`
const selectedDay = () => dateKey()
function seed() {
  const day = selectedDay()
  const contexts = [
    {id:'front',mode:'estudos',name:modes.estudos.context,tasks:['Revisar HTML e CSS','Estudar JavaScript (DOM e eventos)','Construir um componente na prática','Revisar e organizar anotações'].map((text,i)=>({id:uid(),text,done:i===0}))},
    {id:'conteudo',mode:'projetos',name:modes.projetos.context,tasks:['Definir tema do Reels','Escrever o roteiro','Preparar o material','Gravar e editar o Reels'].map((text,i)=>({id:uid(),text,done:i===0}))},
  ]
  const events = [
    ['front','09:00','10:00','Estudar JavaScript','Eventos, funções e interação com o DOM.'],
    ['front','11:00','11:45','Revisar anotações','Consolidar o que aprendeu nesta semana.'],
    ['conteudo','14:00','15:00','Revisar roteiro','Ajustar narrativa e tempo de gravação.'],
    ['front','16:00','17:00','Praticar no Front-end','Aplicar os conceitos em um mini projeto.'],
    ['conteudo','17:00','18:00','Preparar publicação','Separar os materiais para o próximo Reels.'],
  ].map(([context,start,end,title,description],i)=>({id:`example-${i}`,context,start,end,title,description,day,items:[]}))
  return {mode:'estudos',contexts,events,active:{estudos:'front',projetos:'conteudo'},chats:{},alerts:[]}
}
function load(){
  try {
    const stored = JSON.parse(localStorage.getItem(key))
    if(stored?.contexts && stored.events && stored.chats && stored.alerts) return stored
  } catch {}
  return seed()
}
let state=load()
let day=selectedDay()
let toastTimer
const busy = new Set()
const skills = {}
const current = () => state.contexts.find(c=>c.id===state.active[state.mode])
const byContext = (id) => state.contexts.find(c=>c.id===id)
const modeOf = (e) => byContext(e.context)?.mode || 'estudos'
const save = () => {
  try { localStorage.setItem(key,JSON.stringify(state)) }
  catch { toast('O navegador não permitiu salvar os dados locais.') }
}
const update = () => { save(); render() }
function node(tag, cls, value) {
  const el = document.createElement(tag)
  if(cls) el.className=cls
  if(value!==undefined) el.textContent=value
  return el
}
function button(label, cls, action, title){
  const el=node('button',cls,label)
  el.type='button'
  if(title) el.setAttribute('aria-label',title)
  el.addEventListener('click',action)
  return el
}
function toast(message){
  clearTimeout(toastTimer)
  $('toast').textContent=message
  toastTimer=setTimeout(()=>$('toast').textContent='',3500)
}
const eventsFor=(d)=>state.events.filter(e=>e.day===d).sort((a,b)=>a.start.localeCompare(b.start))
function render(){
  const mode = modes[state.mode]
  const context = current()
  document.documentElement.dataset.mode=state.mode
  for(const tab of document.querySelectorAll('button[data-mode]')){
    tab.setAttribute('aria-pressed',String(tab.dataset.mode===state.mode))
  }
  $('tagline').textContent=mode.tagline
  $('skills').replaceChildren(...mode.skills.map(name=>{
    const el=button(name,'',()=>{
      skills[state.mode]=skills[state.mode]===name?'':name
      render()
    })
    el.setAttribute('aria-pressed',String(skills[state.mode]===name))
    return el
  }))
  $('date').value=day
  $('date-label').textContent=`${day===selectedDay()?'Hoje, ':''}${dateLabel(day)}`
  renderAgenda()
  $('context').replaceChildren(...state.contexts.filter(c=>c.mode===state.mode).map(c=>new Option(c.name,c.id,false,c.id===context.id)))
  renderTasks(context)
  renderChat(context,mode)
  renderTimeline()
  renderAlerts()
}
function renderAgenda(){
  const items=eventsFor(day).filter(e=>modeOf(e)===state.mode)
  $('events').replaceChildren(...items.map(e=>{
    const row=node('div','event')
    const open=button('','event-open',()=>editEvent(e),`Abrir ${e.title}`)
    const text=node('span')
    text.append(node('strong','',e.title),node('small','',`${modes[modeOf(e)].name}${e.description?` · ${e.description}`:''}`))
    open.append(node('time','',e.start),text)
    row.append(open)
    return row
  }))
  if(!items.length) $('events').append(node('p','empty','Nenhuma atividade neste dia.'))
}
function renderTasks(context){
  $('tasks').replaceChildren(...context.tasks.map(task=>{
    const row=node('div','task')
    const check=node('input')
    check.type='checkbox'; check.id=`task-${task.id}`; check.checked=task.done
    check.addEventListener('change',()=>{task.done=check.checked;save();renderProgress(context);renderAlerts()})
    const label=node('label','',task.text)
    label.htmlFor=check.id
    row.append(check,label,button('⋯','icon',()=>editTask(context,task),`Editar ${task.text}`))
    return row
  }))
  if(!context.tasks.length) $('tasks').append(node('p','empty','Adicione o primeiro item do checklist.'))
  renderProgress(context)
}
function renderProgress(context){
  const done=context.tasks.filter(t=>t.done).length
  const total=context.tasks.length
  const percent=total?Math.round(done/total*100):0
  $('count').textContent=`${done}/${total}`
  $('percentage').textContent=`${percent}%`
  $('progress').value=percent
  $('progress').setAttribute('aria-label','Progresso do checklist')
}
function renderTimeline(){
  const track=$('timeline')
  const rows=eventsFor(day)
  const lanes=[]
  track.replaceChildren()
  for(let hour=0;hour<=24;hour+=3){
    const tick=node('span','tick',`${String(hour).padStart(2,'0')}h`)
    tick.style.left=`${hour/24*100}%`
    track.append(tick)
  }
  for(const e of rows){
    const start=mins(e.start),end=mins(e.end)
    const lane=lanes.findIndex(available=>available<=start)
    const row=lane<0?lanes.length:lane
    lanes[row]=end
    const item=button(e.title,`block ${modeOf(e)==='estudos'?'study':'project'}`,()=>editEvent(e),`${modes[modeOf(e)].name} · ${e.title} · ${e.start}–${e.end}`)
    item.title=`${e.start}–${e.end} · ${e.title}`
    item.style.left=`${start/1440*100}%`
    item.style.width=`${(end-start)/1440*100}%`
    item.style.top=`${24+row*25}px`
    track.append(item)
  }
  track.style.height=`${27+Math.max(1,lanes.length)*25}px`
  renderClock()
}
function renderClock(){
  const now=new Date()
  const minutes=now.getHours()*60+now.getMinutes()
  $('clock').textContent=`${dateLabel(day)} · ${clockText(minutes)}`
  $('timeline').querySelector('.now')?.remove()
  if(day!==dateKey(now)) return
  const mark=node('span','now')
  mark.style.left=`${minutes/1440*100}%`
  mark.setAttribute('aria-label',`Agora, ${clockText(minutes)}`)
  $('timeline').append(mark)
}
function field(label,name,type,value='',required=true){
  const wrap=node('label','',label)
  const control=node(type==='textarea'?'textarea':'input')
  if(type!=='textarea') control.type=type
  control.name=name
  control.value=value
  control.required=required
  if(type==='text'||type==='textarea') control.maxLength=type==='text'?100:320
  wrap.append(control)
  return wrap
}
function selectField(label,name,entries,value){
  const wrap=node('label','',label)
  const select=node('select')
  select.name=name
  for(const option of entries) select.add(new Option(option.label,option.value,false,option.value===value))
  wrap.append(select)
  return wrap
}
function modal(title, fields, submit, remove, label='Salvar'){
  const dialog=$('editor')
  const heading=node('h2','',title)
  const form=node('form')
  const error=node('p','error')
  error.setAttribute('role','alert')
  const actions=node('div','actions')
  const send=node('button','action primary',label)
  send.type='submit'
  actions.append(send,button('Cancelar','action',()=>dialog.close()))
  if(remove) {
    const del=button('Excluir','action danger',()=>{
      if(del.dataset.confirm==='true'){ dialog.close();remove();return }
      del.dataset.confirm='true'
      del.textContent='Confirmar exclusão'
      error.textContent='Confirme para excluir este registro.'
    })
    actions.append(del)
  }
  form.append(...fields,error,actions)
  form.addEventListener('submit',event=>{
    event.preventDefault()
    const warning=submit(new FormData(form))
    if(warning) error.textContent=warning
    else dialog.close()
  })
  dialog.replaceChildren(heading,form)
  if(!dialog.open) dialog.showModal()
}
const value=(form,k)=>String(form.get(k)||'').trim()
function editEvent(existing, proposal, confirmProposal){
  const event=existing||proposal||{context:current().id,day,start:'09:00',end:'10:00',title:'',description:'',items:[]}
  const contexts=state.contexts.map(c=>({value:c.id,label:`${modes[c.mode].name} · ${c.name}`}))
  const contextField=selectField('Modo e contexto','context',contexts,event.context)
  const row=node('div','form-row')
  row.append(field('Início','start','time',event.start),field('Fim','end','time',event.end))
  const items=node('fieldset')
  items.append(node('legend','','Itens previstos para o bloco'))
  function showItems(){
    items.replaceChildren(node('legend','','Itens previstos para o bloco'))
    const ctx=byContext(contextField.querySelector('select').value)
    for(const task of ctx.tasks){
      const label=node('label','event-item')
      const box=node('input')
      box.type='checkbox';box.name='items';box.value=task.id;box.checked=event.items.includes(task.id)
      label.append(box,node('span','',task.text))
      items.append(label)
    }
    if(!ctx.tasks.length) items.append(node('small','','Este contexto ainda não tem itens.'))
  }
  contextField.addEventListener('change',showItems)
  showItems()
  let acknowledged=''
  modal(existing?'Editar atividade':proposal?'Confirmar atividade':'Nova atividade',[
    field('Atividade','title','text',event.title),contextField,
    field('Data','day','date',event.day),row,
    field('Descrição','description','textarea',event.description,false),items,
  ],form=>{
    const record={id:existing?.id||uid(),context:value(form,'context'),day:value(form,'day'),start:value(form,'start'),end:value(form,'end'),title:value(form,'title'),description:value(form,'description'),items:form.getAll('items')}
    if(!record.title) return 'Informe o título da atividade.'
    if(record.end<=record.start) return 'O horário de fim precisa ser depois do início.'
    const clash=eventsFor(record.day).find(e=>e.id!==existing?.id&&e.start<record.end&&e.end>record.start)
    const slot=`${record.day}/${record.start}/${record.end}`
    if(clash&&acknowledged!==slot){
      acknowledged=slot
      const free=findSlot(record.day,record.start,mins(record.end)-mins(record.start),existing?.id)
      return `Conflito com ${clash.title} (${clash.start}–${clash.end}). ${free?`Outra opção: ${free.start}–${free.end}. `:''}Salve de novo para confirmar a sobreposição.`
    }
    if(existing) Object.assign(existing,record)
    else state.events.push(record)
    const mode=modeOf(record)
    day=record.day
    state.mode=mode
    state.active[mode]=record.context
    confirmProposal?.(record)
    update()
    toast(existing?'Atividade atualizada.':'Atividade adicionada.')
  },existing?()=>{
    state.events=state.events.filter(e=>e.id!==existing.id)
    update()
    toast('Atividade excluída.')
  }:null,proposal?'Confirmar atividade':'Salvar')
}
function editTask(context,task){
  modal(task?'Editar item':'Novo item',[field('Item do checklist','text','text',task?.text)],form=>{
    const text=value(form,'text')
    if(!text) return 'Informe o texto do item.'
    if(task) task.text=text
    else context.tasks.push({id:uid(),text,done:false})
    update()
  },task?()=>{
    context.tasks=context.tasks.filter(item=>item.id!==task.id)
    for(const e of state.events.filter(e=>e.context===context.id)) e.items=e.items.filter(id=>id!==task.id)
    update()
    toast('Item excluído.')
  }:null)
}
function addContext(){
  const label=state.mode==='estudos'?'Novo assunto de estudo':'Novo projeto'
  modal(label,[field('Nome','name','text')],form=>{
    const name=value(form,'name')
    if(!name) return 'Informe um nome.'
    const context={id:uid(),mode:state.mode,name,tasks:[]}
    state.contexts.push(context)
    state.active[context.mode]=context.id
    update()
  })
}
function chatFor(context){
  return state.chats[context.id] ||= [{
    role:'agent',
    text:context.mode==='estudos'?'Olá, Guilherme! Qual é o próximo passo?\nPosso te ajudar a planejar uma sessão e reservar um horário na agenda.':'Olá, Guilherme! Vamos avançar no seu projeto?\nPosso te ajudar a organizar os próximos passos e reservar um horário para executar.',
  }]
}
function renderChat(context, mode){
  $('chat-context').textContent=`${context.mode==='estudos'?'Estudo':'Projeto'} · ${context.name}${skills[context.mode]?` · ${skills[context.mode]}`:''}`
  $('message').placeholder=context.mode==='estudos'?'O que vamos aprender hoje?':'Como posso ajudar no seu projeto?'
  $('quick').replaceChildren(...[...mode.quick,'Comandos'].map(text=>button(text,'',()=>send(text))))
  document.querySelector('.hero').classList.toggle('speaking',busy.has(context.id))
  const feed=$('messages')
  feed.replaceChildren(...chatFor(context).map(message=>{
    const entry=node('article',`message ${message.role}`)
    entry.append(node('small','',message.role==='user'?'Você':'Assistente IA'),node('div','bubble',message.text))
    if(message.deletion && !message.applied){
      const {kind,id,label}=message.deletion
      const actions=node('div','actions')
      actions.append(button('Confirmar exclusão','action danger',()=>{
        const target=kind==='task'?context.tasks.find(t=>t.id===id):state.events.find(e=>e.id===id&&e.context===context.id)
        if(target && (target.text??target.title)===label){
          if(kind==='task'){
            context.tasks=context.tasks.filter(t=>t.id!==id)
            for(const e of state.events.filter(e=>e.context===context.id)) e.items=e.items.filter(item=>item!==id)
          }else state.events=state.events.filter(e=>e.id!==id)
          message.text='Exclusão concluída: '+label
        }else message.text='O registro mudou. Confira o painel antes de pedir a exclusão novamente.'
        message.applied=true;update()
      }),button('Cancelar','action',()=>{message.applied=true;message.text='Exclusão cancelada.';update()}))
      entry.append(actions)
    }
    if(message.proposal&&!message.applied){
      const actions=node('div','actions')
      actions.append(button('Revisar e confirmar','action primary',()=>editEvent(null,message.proposal,record=>{
        message.applied=true
        chatFor(context).push({role:'agent',text:`Atividade reservada para ${dateLabel(record.day)}, das ${record.start} às ${record.end}.`})
      })))
      entry.append(actions)
    }
    return entry
  }))
  if(busy.has(context.id)) feed.append(node('p','empty','Preparando resposta…'))
  feed.scrollTop=feed.scrollHeight
}
function findSlot(date,start,duration,exclude){
  const rows=eventsFor(date).filter(e=>e.id!==exclude)
  let minute=mins(start)
  for(const e of rows){
    if(minute+duration<=mins(e.start)) break
    if(minute<mins(e.end)) minute=mins(e.end)
  }
  if(minute+duration>=1440) return null
  return {start:clockText(minute),end:clockText(minute+duration)}
}
function localCommand(text, context, selectedDate) {
  const reply = text => ({role:'agent',text})
  const help = 'Experimente:\n• Marca revisão amanhã às 19h por 45 minutos\n• Move revisão para as 20h\n• Excluir atividade revisão\n• Adicionar item escrever roteiro\n• Renomear item escrever roteiro para revisar roteiro\n• Concluir item revisar roteiro\n• Excluir item revisar roteiro'
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  const clean = s => s.trim().replace(/^["“](.*)["”]$/, '$1').trim()
  const input = text.trim().replace(/[.!]$/, '')
  if (/^(ajuda|comandos|o que posso pedir)\??$/i.test(input)) return reply(help)
  const items = context.tasks
  const events = state.events.filter(e=>e.context===context.id)
  function lookup(list, name, field) {
    const matches = list.filter(row=>norm(row[field])===norm(clean(name)))
    if(matches.length===1) return matches[0]
    return reply(matches.length ? 'Há vários registros com esse nome. Abra o registro desejado no painel para editá-lo.' : `Não encontrei “${clean(name)}” neste contexto. Confira o nome no painel.`)
  }
  const item = input.match(/^(adicion(?:a|ar|e)|cri(?:a|ar|e)|conclu(?:i|ir|a)|reabr(?:e|ir|a)|renome(?:ia|ar|ie)|exclu(?:i|ir|a)|remov(?:e|er|a))\s+(?:o\s+|um\s+)?item\s+(.+)$/i)
  if(item){
    const verb=norm(item[1])
    let title=clean(item[2])
    if(/^(adicion|cri)/.test(verb)){
      if(!title || title.length>100) return reply('Use um nome entre 1 e 100 caracteres.')
      if(items.some(t=>norm(t.text)===norm(title))) return reply('Esse item já está no checklist.')
      items.push({id:uid(),text:title,done:false})
      return reply(`Adicionei “${title}” ao checklist de ${context.name}.`)
    }
    let newTitle
    if(verb.startsWith('renome')){
      const names=title.match(/^(.+?)\s+para\s+(.+)$/i)
      if(!names) return reply('Use “renomear item nome atual para novo nome”.')
      title=names[1];newTitle=clean(names[2])
      if(!newTitle || newTitle.length>100) return reply('Use um novo nome entre 1 e 100 caracteres.')
    }
    const task=lookup(items,title,'text')
    if(task.role) return task
    if(/^(exclu|remov)/.test(verb)) return deletion('task',task.id,task.text)
    if(newTitle){task.text=newTitle;return reply(`Item renomeado para “${newTitle}”.`)}
    task.done=verb.startsWith('conclu')
    return reply(`${task.done?'Concluí':'Reabri'} “${task.text}”.`)
  }
  function deletion(kind,id,label){
    return {...reply(`Excluir “${label}” de ${context.name}?`),deletion:{kind,id,label}}
  }
  const remove=input.match(/^(?:exclu(?:ir|i|a)|remov(?:er|e|a))\s+(?:a\s+)?(?:atividade|sessão|compromisso)\s+(.+)$/i)
  if(remove){
    const event=lookup(events,remove[1],'title')
    return event.role ? event : deletion('event',event.id,event.title)
  }
  const schedule=input.match(/^(marca(?:r)?|marque|agend(?:a|ar|e)|reserv(?:a|ar|e)|mov(?:e|er|a)|reagend(?:a|ar|e))\s+(.+)$/i)
  if(!schedule) return null
  const move=/^(mov|reagend)/i.test(schedule[1])
  const details=schedule[2].match(/^(.+?)\s+(?:para\s+)?(?:(hoje|amanhã|amanha)\s+)?(?:[aà]s?\s+)?(\d{1,2})(?:h([0-5]\d)?|:([0-5]\d))?(?:\s+por\s+(\d+)\s*(minutos?|min|horas?|h))?$/i)
  if(!details) return reply('Informe o nome e o horário. Exemplo: “marca revisão amanhã às 19h por 45 minutos”.')
  const title=clean(details[1])
  if(!title || title.length>100 || Number(details[3])>23) return reply('Confira o título e use um horário entre 00h e 23h59.')
  const previous=move?lookup(events,title,'title'):null
  if(previous?.role) return previous
  let date=previous?.day||selectedDate
  if(details[2]){
    const target=new Date()
    if(norm(details[2])==='amanha') target.setDate(target.getDate()+1)
    date=dateKey(target)
  }
  const start=Number(details[3])*60+Number(details[4]||details[5]||0)
  const duration=details[6]?Number(details[6])*(details[7].startsWith('h')?60:1):previous?mins(previous.end)-mins(previous.start):60
  if(duration<=0 || start+duration>=1440) return reply('Escolha um bloco com duração positiva que termine antes da meia-noite.')
  const end=start+duration
  const clash=eventsFor(date).find(e=>e.id!==previous?.id&&mins(e.start)<end&&mins(e.end)>start)
  if(clash){
    const free=findSlot(date,clockText(start),duration,previous?.id)
    return reply(`Conflito com ${modes[modeOf(clash)].name}, das ${clash.start} às ${clash.end}. ${free?`Há espaço das ${free.start} às ${free.end}. Repita o pedido com o novo horário.`:'Escolha outro dia ou horário.'}`)
  }
  const record=previous||{id:uid(),context:context.id,title,description:'',items:[]}
  Object.assign(record,{day:date,start:clockText(start),end:clockText(end)})
  if(!previous) state.events.push(record)
  if(current()?.id===context.id && day===selectedDate) day=date
  return reply(`${move?'Reagendei':'Marquei'} “${record.title}” para ${dateLabel(date)}, das ${record.start} às ${record.end}.`)
}
function demoResponse(text,context,askedDay){
  const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if(/planej|marc|agend|reserv|sessao/.test(normalized)){
    const now=new Date()
    const askTime=normalized.match(/\b([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))\b/)
    let date=askedDay
    if(/\bamanha\b/.test(normalized)) { now.setDate(now.getDate()+1);date=dateKey(now) }
    else if(/\bhoje\b/.test(normalized)) date=selectedDay()
    let minute=540
    if(askTime) minute=Number(askTime[1])*60+Number(askTime[2]||askTime[3]||0)
    else if(date===selectedDay()) minute=Math.max(minute,Math.ceil((now.getHours()*60+now.getMinutes()+1)/30)*30)
    const limit=Math.min(minute,1439)
    let slot=findSlot(date,clockText(limit),60)
    if(!slot){
      const next=dateOf(date);next.setDate(next.getDate()+1);date=dateKey(next)
      slot=findSlot(date,'09:00',60)
    }
    if(!slot) return {role:'agent',text:'Os horários consultados estão cheios. Use “Nova atividade” para escolher outra data.'}
    const title=context.mode==='estudos'?`Sessão · ${context.name}`:`Desenvolver · ${context.name}`
    const items=context.tasks.filter(t=>!t.done).slice(0,2)
    const proposal={context:context.id,day:date,...slot,title:title.slice(0,100),description:items.map(t=>t.text).join(' · '),items:items.map(t=>t.id)}
    return {role:'agent',text:`Encontrei uma hora livre em ${dateLabel(date)}, das ${slot.start} às ${slot.end}.${items.length?`\nSugestão de foco: ${items.map(t=>t.text).join(' e ')}.`:''}\nRevise a proposta para adicionar o bloco à agenda.`,proposal}
  }
  const next=context.tasks.find(t=>!t.done)
  if(/explica/.test(normalized)) return {role:'agent',text:`Podemos trabalhar em “${next?.text||context.name}”. Comece por um exemplo pequeno, explique com suas palavras o que aconteceu e tente repetir sem consultar o exemplo.\nPara reservar tempo, escolha “Planejar sessão”.`}
  return {role:'agent',text:next?`O próximo item do checklist é “${next.text}”. Você pode concluí-lo no painel ou me pedir para planejar um bloco na agenda.`:'Seu checklist está em dia. Você pode adicionar um item ou me pedir para planejar um bloco.'}
}
function send(text){
  const context=current()
  if(!text.trim()) return
  if(busy.has(context.id)){toast('Aguarde a resposta atual.');return}
  const requestedDay=day
  chatFor(context).push({role:'user',text:text.trim()})
  busy.add(context.id)
  update()
  setTimeout(()=>{
    chatFor(context).push(localCommand(text,context,requestedDay) || demoResponse(text,context,requestedDay))
    busy.delete(context.id)
    update()
  },850)
}
function renderAlerts(){
  const pending=state.alerts.filter(a=>!a.snooze||a.snooze<=Date.now())
  $('unread').hidden=!pending.some(a=>!a.read)
  const section=$('notifications')
  section.replaceChildren(node('div','heading'))
  section.firstChild.append(node('h2','','Notificações'),button('×','icon',toggleBell,'Fechar notificações'))
  for(const a of pending){
    const row=node('article')
    row.append(node('strong','',`${a.read?'':'● '}${a.title}`),node('p','',a.text))
    const actions=node('div','actions')
    actions.append(
      button('Abrir','action',()=>{
        const context=byContext(a.context)
        state.mode=context.mode; state.active[context.mode]=context.id
        a.read=true
        toggleBell()
        update()
        document.querySelector('.checklist').closest('details').open=true
        document.querySelector('.checklist').scrollIntoView({block:'nearest'})
        $('context').focus({preventScroll:true})
      }),
      button('Adiar 15 min','action',()=>{a.snooze=Date.now()+900000;a.read=false;update();toast('Alerta adiado por 15 minutos.')}),
      button('Marcar como lido','action',()=>{a.read=true;update()}))
    actions.lastChild.disabled=a.read
    row.append(actions)
    section.append(row)
  }
  if(!pending.length) section.append(node('p','','Nenhum aviso neste momento.'))
  section.append(button('Gerar alerta de teste','link',()=>{
    const context=current()
    state.alerts.unshift({id:uid(),context:context.id,title:'Prazo próximo · Demo',text:`${context.name}: confira o checklist antes da entrega.`,read:false})
    update()
  }))
}
function toggleBell(){
  const section=$('notifications')
  section.hidden=!section.hidden
  $('bell').setAttribute('aria-expanded',String(!section.hidden))
  if(section.hidden) $('bell').focus()
}
function shiftDay(amount){
  const date=dateOf(day)
  date.setDate(date.getDate()+amount)
  day=dateKey(date)
  render()
}
for(const tab of document.querySelectorAll('button[data-mode]')) tab.addEventListener('click',()=>{state.mode=tab.dataset.mode;update()})
for(const add of document.querySelectorAll('[data-add]')) add.addEventListener('click',()=>{
  if(add.dataset.add==='event') editEvent()
  if(add.dataset.add==='task') editTask(current())
  if(add.dataset.add==='context') addContext()
})
$('context').addEventListener('change',event=>{state.active[state.mode]=event.target.value;update()})
$('prev').addEventListener('click',()=>shiftDay(-1))
$('next').addEventListener('click',()=>shiftDay(1))
$('today').addEventListener('click',()=>{day=selectedDay();render()})
$('date').addEventListener('change',event=>{if(event.target.value){day=event.target.value;render()}})
$('bell').addEventListener('click',toggleBell)
addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('notifications').hidden&&!$('editor').open) toggleBell()})
$('chat-form').addEventListener('submit',event=>{
  event.preventDefault()
  if(busy.has(current().id)){toast('Aguarde a resposta atual.');return}
  send($('message').value)
  $('message').value=''
})
setInterval(()=>{renderClock();renderAlerts()},15000)
const compact=matchMedia('(max-width: 640px)')
function adapt(event){ document.querySelector('.sidebar').open=!event.matches }
compact.addEventListener('change',adapt)
adapt(compact)
render()


