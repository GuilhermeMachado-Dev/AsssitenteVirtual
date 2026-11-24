'use strict'

// A autorização da agenda dura somente enquanto esta página está aberta.
let calendarConnection = null
const calendarButton = $('connect-calendar')
const calendarStatus = $('calendar-status')

window.resetCalendar = () => {
  calendarConnection = null
  calendarDays.clear()
  calendarButton.hidden = true
  calendarStatus.textContent = ''
}
window.enableCalendar = (user, authApi) => {
  const connection = {user, token:null, loading:new Set(), errors:new Set()}
  calendarConnection = connection
  calendarButton.hidden = false
  calendarButton.textContent = 'Conectar Google Agenda'
  calendarStatus.textContent = 'Calendário principal desconectado'
  calendarButton.onclick = async () => {
    try {
      calendarButton.disabled = true
      if (!connection.token) {
        const provider = new authApi.GoogleAuthProvider()
        provider.addScope('https://www.googleapis.com/auth/calendar.events.readonly')
        provider.setCustomParameters({login_hint:user.email})
        const result = await authApi.reauthenticateWithPopup(user,provider)
        if (calendarConnection !== connection) return
        connection.token = authApi.GoogleAuthProvider.credentialFromResult(result)?.accessToken
        if (!connection.token) throw new Error('auth')
      }
      calendarDays.delete(day)
      connection.errors.delete(day)
      await window.refreshCalendarDay(day)
    } catch {
      if (calendarConnection === connection) calendarStatus.textContent = 'Conexão não concluída. Use a mesma conta e permita a leitura da agenda.'
    } finally { calendarButton.disabled = false }
  }
}

window.refreshCalendarDay = async selected => {
  const c = calendarConnection
  if (!c?.token) return
  calendarButton.textContent = 'Atualizar Google Agenda'
  if (calendarDays.has(selected)) {
    if(day===selected) calendarStatus.textContent = calendarDays.get(selected).length ? 'Calendário principal' : 'Sem compromissos no calendário principal'
    return
  }
  if (c.errors.has(selected)) {
    if(day===selected) calendarStatus.textContent = 'Falha ao consultar o Google Agenda. Tente atualizar.'
    return
  }
  if(day===selected) calendarStatus.textContent = 'Consultando o Google Agenda…'
  if (c.loading.has(selected)) return
  c.loading.add(selected)
  const start = new Date(selected+'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate()+1)
  const query = new URLSearchParams({timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,fields:'nextPageToken,items(id,summary,start,end,status)'})
  const rows = []
  try {
    do {
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?'+query,{headers:{Authorization:'Bearer '+c.token}})
      if (calendarConnection !== c) return
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      for (const item of data.items || []) {
        if (item.status === 'cancelled') continue
        const allDay = !!item.start?.date
        if (allDay && !(item.start.date <= selected && selected < item.end.date)) continue
        const from = new Date(item.start.dateTime)
        const to = new Date(item.end.dateTime)
        const clock = d => clockText(d.getHours()*60+d.getMinutes())
        rows.push({google:true,id:'google:'+item.id,title:item.summary || 'Ocupado',day:selected,allDay,
          start:allDay || from<=start ? '00:00' : clock(from),
          end:allDay || to>=end ? '24:00' : clock(to)})
      }
      if (!data.nextPageToken) break
      query.set('pageToken',data.nextPageToken)
    } while (calendarConnection === c)
    if (calendarConnection !== c) return
    calendarDays.set(selected,rows)
    if (day===selected) {renderAgenda();renderTimeline()}
  } catch (err) {
    if (calendarConnection !== c) return
    c.errors.add(selected)
    if (['401','403'].includes(err.message)) {
      c.token = null
      calendarDays.clear()
      calendarButton.textContent = 'Reconectar Google Agenda'
      calendarStatus.textContent = 'Confira a autorização de leitura do Google Agenda.'
      renderAgenda();renderTimeline()
    } else if(day===selected) calendarStatus.textContent = 'Falha ao consultar o Google Agenda. Tente atualizar.'
  } finally { c.loading.delete(selected) }
}

async function answerCalendarQuestion(text, selected) {
  const q = text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if (!/agenda|calendario|compromissos/.test(q) || !/quais|mostrar|mostr[ae]|consultar|tenho|informacoes|listar|o que|proximos dias/.test(q)) return null
  if (!calendarConnection?.token) return 'Abra a Agenda e selecione “Conectar Google Agenda” para consultar seus compromissos reais.'
  const count = /proximos dias|semana/.test(q) ? 7 : 1
  const cursor = dateOf(selected)
  if (/amanha/.test(q)) cursor.setDate(cursor.getDate()+1)
  const lines = []
  for (let i=0;i<count;i++) {
    const date = dateKey(cursor)
    await window.refreshCalendarDay(date)
    if (!calendarDays.has(date)) return 'Ainda não consegui consultar todo o período. Atualize a conexão na Agenda e tente novamente.'
    for (const event of calendarDays.get(date)) lines.push(dateLabel(date)+' · '+(event.allDay?'Dia inteiro':event.start+'–'+event.end)+' · '+event.title)
    cursor.setDate(cursor.getDate()+1)
  }
  return lines.length ? 'No seu Google Agenda:\n'+lines.join('\n') : 'Seu calendário principal não tem compromissos nesse período.'
}
