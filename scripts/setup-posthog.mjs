// Management API only. Supply POSTHOG_PERSONAL_API_KEY in the process environment.
const host='https://us.posthog.com',project=684056,key=process.env.POSTHOG_PERSONAL_API_KEY;
if(!key)throw Error('POSTHOG_PERSONAL_API_KEY is required.');
async function request(path,body,method=body?'POST':'GET'){
 const response=await fetch(host+path,{method,redirect:'error',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
 const value=await response.json();if(!response.ok)throw Error(`PostHog HTTP ${response.status}: ${JSON.stringify(value).slice(0,1000)}`);if(value.error)throw Error(String(value.error));return value;
}
const base=`/api/projects/${project}`,days={date_from:'-30d'},node=(event,math='total')=>({kind:'EventsNode',event,name:event,math});
const trends=(events,breakdown,math='total')=>({kind:'TrendsQuery',dateRange:days,interval:'day',series:events.map(e=>node(e,math)),trendsFilter:{display:'ActionsLineGraph'},...(breakdown?{breakdownFilter:{breakdown,breakdown_type:'event'}}:{})});
const sql=query=>({kind:'DataTableNode',source:{kind:'HogQLQuery',query},full:true});
const retention=(period,totalIntervals,date_from)=>({kind:'RetentionQuery',dateRange:{date_from},retentionFilter:{retentionType:'retention_first_time',period,totalIntervals,targetEntity:{id:'app_opened',type:'events'},returningEntity:{id:'app_opened',type:'events'}}});
const funnel={kind:'FunnelsQuery',dateRange:days,series:['app_opened','onboarding_started','menu_generation_finished','menu_preview_viewed','sign_in_finished','menu_approved','cooking_started','cooking_completed'].map(event=>({...node(event),...(['menu_generation_finished','sign_in_finished'].includes(event)?{properties:[{key:'success',type:'event',operator:'exact',value:true}]}:{})})),funnelsFilter:{funnelWindowInterval:30,funnelWindowIntervalUnit:'day'}};
const boards=[
 {name:'Активация и функции',description:'Первая версия Frigo: прохождение основного пути и использование разделов. Все пользователи, без сегментации аудитории.',reports:[
  ['Активные пользователи по дням',trends(['app_opened'],null,'dau'),'Уникальные пользователи, открывшие приложение.'],
  ['Воронка: первое меню → завершение готовки',funnel,'Упорядоченная воронка за 30 дней. Ошибки генерации и входа исключены из успешных шагов.'],
  ['До каких вопросов доходят',trends(['onboarding_step_completed'],'step_number','dau'),'Уникальные пользователи, завершившие каждый вопрос; повторные прохождения не увеличивают число пользователей.'],
  ['Популярность экранов',trends(['screen_viewed'],'screen_name','dau'),'Уникальные пользователи каждого экрана.'],
  ['Использование функций — число действий',trends(['feature_used'],'action'),'Абсолютное количество подтверждённых действий.'],
  ['Ошибки генерации и входа',sql("SELECT event, countIf(properties.success = true) AS successful, countIf(properties.success = false) AS failed FROM events WHERE event IN ('menu_generation_finished','sign_in_finished') AND timestamp >= now() - INTERVAL 30 DAY GROUP BY event"),'Без текстов ошибок или персональных данных.']
 ]},
 {name:'Готовка и сценарии',description:'Абсолютные количества, а не только конверсии. Нулевые значения включены в распределение по открывавшим приложение пользователям.',reports:[
  ['Начатые и завершённые готовки по дням',trends(['cooking_started','cooking_completed']),'Открытие пошаговой готовки и первое завершение блюда. Повторное подтверждение готовности не учитывается.'],
  ['Количество сценариев на пользователя',sql("SELECT toString(person_id) AS user_id, countIf(event='menu_approved') AS menus_approved, countIf(event='cooking_started') AS cooking_started, countIf(event='cooking_completed') AS cooking_completed, countIf(event='feature_used' AND properties.action='shopping_item_added_home') AS purchases_added_home, countIf(event='feature_used' AND properties.action='pantry_updated') AS pantry_updates FROM events WHERE event IN ('app_opened','menu_approved','cooking_started','cooking_completed','feature_used') AND timestamp >= now() - INTERVAL 30 DAY GROUP BY person_id ORDER BY cooking_completed DESC, cooking_started DESC LIMIT 200"),'Число сценариев за 30 дней на каждого пользователя (PostHog person ID, без имён).'],
  ['Сколько готовок у пользователей: 0, 1, 2…',sql("SELECT completed, count() AS users FROM (SELECT person_id, countIf(event='cooking_completed') AS completed FROM events WHERE event IN ('app_opened','cooking_started','cooking_completed') AND timestamp >= now() - INTERVAL 30 DAY GROUP BY person_id) GROUP BY completed ORDER BY completed"),'Включает пользователей с нулём завершённых готовок.'],
  ['Общие абсолютные показатели готовки',sql("SELECT countIf(event='cooking_started') AS started, countIf(event='cooking_completed') AS completed, count(DISTINCT if(event='cooking_completed', person_id, NULL)) AS users_completed FROM events WHERE event IN ('cooking_started','cooking_completed') AND timestamp >= now() - INTERVAL 30 DAY"),'Суммарные начала, завершения и пользователи с завершённой готовкой.']
 ]},
 {name:'Возвраты и вовлечённость',description:'Retention по повторному открытию приложения. Активное время: видимая вкладка в фокусе, до 60 секунд без взаимодействия. Фон и простой не считаются.',reports:[
  ['Дневной retention',retention('Day',14,'-30d'),'Когорты первого app_opened → повторный app_opened, 14 дней.'],
  ['Недельный retention',retention('Week',8,'-8w'),'Возвраты по неделям; данные накопятся с течением времени.'],
  ['Активные минуты и минуты на пользователя по дням',sql("SELECT toDate(timestamp) AS day, round(sum(toFloat(properties.active_seconds))/60, 2) AS active_minutes, count(DISTINCT person_id) AS active_users, round(sum(toFloat(properties.active_seconds))/60/count(DISTINCT person_id), 2) AS minutes_per_active_user FROM events WHERE event='engagement_tick' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY day ORDER BY day"),'Сумма интервальных active_seconds. Это активное время, а не длительность открытой вкладки.'],
  ['Активное время и сессии на пользователя',sql("SELECT toString(person_id) AS user_id, count(DISTINCT properties.$session_id) AS sessions, round(sum(toFloat(properties.active_seconds))/60,2) AS active_minutes, round(sum(toFloat(properties.active_seconds))/60/count(DISTINCT properties.$session_id),2) AS minutes_per_session FROM events WHERE event='engagement_tick' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY person_id ORDER BY active_minutes DESC LIMIT 200"),'Сессии определяет SDK PostHog; короткие посещения отправляются при уходе со страницы.'],
  ['Где проводят активное время',sql("SELECT properties.screen_name AS screen, round(sum(toFloat(properties.active_seconds))/60,2) AS active_minutes FROM events WHERE event='engagement_tick' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY screen ORDER BY active_minutes DESC"),'Активные минуты по экранам.']
 ]},
 {name:'Привлечение',description:'Первый источник браузера сохраняется между визитами: UTM source/medium/campaign либо домен реферера, либо direct. Полные URL и параметры вне UTM не отправляются.',reports:[
  ['Посетители по источнику',trends(['app_opened'],'first_source','dau'),'Уникальные посетители по первому источнику.'],
  ['Посетители по кампании',trends(['app_opened'],'first_campaign','dau'),'Заполняется для ссылок с utm_campaign.'],
  ['Новые пользователи по дням и источникам',sql("SELECT toDate(first_visit) AS day, source, count() AS new_users FROM (SELECT person_id, min(timestamp) AS first_visit, argMin(properties.first_source,timestamp) AS source FROM events WHERE event='app_opened' GROUP BY person_id) WHERE first_visit >= now() - INTERVAL 30 DAY GROUP BY day, source ORDER BY day, new_users DESC"),'Первое наблюдаемое открытие приложения в PostHog; события до внедрения аналитики восстановить нельзя.']
 ]}
];
for(const board of boards)for(const [name,query] of board.reports){await request(base+'/query/',{query});console.log('Validated:',name);}
if(process.argv.includes('--validate-only'))process.exit(0);
async function list(path){const rows=[];for(let next=path;next;){const page=await request(next);rows.push(...page.results);if(page.next){const u=new URL(page.next,host);if(u.origin!==host)throw Error('Unexpected pagination host');next=u.pathname+u.search;}else next=null;}return rows;}
const dashboards=await list(base+'/dashboards/?limit=100'),insights=await list(base+'/insights/?limit=100');
const output=[];
for(const board of boards){
 const name='Frigo · '+board.name,existing=dashboards.find(d=>d.name===name);
 const dashboard=await request(base+'/dashboards/'+(existing?existing.id+'/':''),{name,description:'[frigo-v1] '+board.description,tags:['frigo-v1']},existing?'PATCH':'POST');
 for(const [title,query,description] of board.reports){
  const name='Frigo · '+title,old=insights.find(i=>i.name===name&&i.tags?.includes('frigo-v1'));
  await request(base+'/insights/'+(old?old.id+'/':''),{name,description,query,tags:['frigo-v1'],dashboards:[dashboard.id]},old?'PATCH':'POST');
 }
 output.push({name,url:`${host}/project/${project}/dashboard/${dashboard.id}`});
}
console.log(JSON.stringify(output,null,2));
