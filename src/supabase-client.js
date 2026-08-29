import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://eltrdqnrbqsfsuwykdyj.supabase.co';
const SUPABASE_KEY='sb_publishable_Fp-9i9ZOdTJhy1MfrZ4cEw_MujAEOf9';
export const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const uuid=()=>crypto.randomUUID();
const pence=n=>Math.round(Number(n||0)*100);
const pounds=n=>Number(n||0)/100;
const safeJson=value=>{try{return typeof value==='string'?JSON.parse(value):value}catch{return {}}};
const fail=error=>{throw new Error(error?.message||'Supabase request failed')};
const toIso=value=>{
  if(!value)return new Date().toISOString();
  const direct=new Date(value);if(!Number.isNaN(direct.getTime()))return direct.toISOString();
  const match=String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(match){const [,day,month,year,hour,minute,second='0']=match;return new Date(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute),Number(second)).toISOString()}
  throw new Error('A saved date could not be converted. Please sign out and back in, then retry.');
};

export async function pinLogin(pin){
  const response=await fetch(`${SUPABASE_URL}/functions/v1/pin-login`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({pin})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'PIN not recognised. Try again.');
  const {error}=await supabase.auth.setSession({access_token:body.session.access_token,refresh_token:body.session.refresh_token});
  if(error)fail(error);
  return {id:body.staff.id,name:body.staff.displayName,role:body.staff.role==='cashier'?'Staff':'Manager',permissions:body.staff.role==='cashier'?(body.staff.permissions||[]):['stock','reports','products','staff','comp']};
}

export async function signOut(){await supabase.auth.signOut({scope:'local'})}

export async function importBrowserProducts(seedProducts){
  let browserProducts=[];
  try{browserProducts=JSON.parse(localStorage.getItem('lol-pos-state')||'{}')?.products||[]}catch{}
  const products=browserProducts.length?browserProducts:seedProducts;
  if(!products.length)return {imported:0,rejected:[]};
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch(`${SUPABASE_URL}/functions/v1/import-browser-products`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({products:products.map((x,i)=>({...x,sku:x.sku||`LEGACY-${x.id||i+1}`,price_pence:pence(x.price),stock_quantity:x.stock,sales_area:x.area,subcategory:x.sub,emoji:x.emoji}))})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'Product import failed');
  localStorage.removeItem('lol-pos-state');
  return body;
}

export async function createStaff({name,pin,role,permissions=[]}){
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-staff`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({action:'create',displayName:name,pin,role:role==='Manager'?'manager':'cashier',permissions})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'Could not create staff');
  return body.staff;
}

export async function updateStaff({id,name,role,active,permissions=[]}){
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-staff`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({action:'update',staffId:id,displayName:name,role:role==='Manager'?'manager':'cashier',active,permissions})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'Could not update staff');
  return body.staff;
}

export async function loadState(){
  const names=['staff','products','sales','transaction_items','customer_tabs','promotions','floats','till_checks','stock_checks','end_of_trade_reports','audit_logs','cash_movements','stock_movements','report_corrections'];
  const results=await Promise.all(names.map(name=>supabase.from(name).select('*')));
  const bad=results.find(x=>x.error);if(bad)fail(bad.error);
  const [staff,products,sales,items,tabs,promotions,floats,tillChecks,stockChecks,reports,auditLogs,cashMovements,stockMovements,reportCorrections]=results.map(x=>x.data||[]);
  const latestMain=floats.filter(x=>x.till_name==='Main Till').sort((a,b)=>new Date(b.opened_at)-new Date(a.opened_at))[0];
  const latestMachine=floats.filter(x=>x.till_name==='Machine CM').sort((a,b)=>new Date(b.opened_at)-new Date(a.opened_at))[0];
  const latestPool=floats.filter(x=>x.till_name==='Pool').sort((a,b)=>new Date(b.opened_at)-new Date(a.opened_at))[0];
  const activeTradeStart=latestMain?.status==='open'?new Date(latestMain.opened_at).getTime():null;
  const belongsToActiveTrade=(row,dateKey='created_at')=>activeTradeStart!==null&&new Date(row?.[dateKey]).getTime()>=activeTradeStart;
  const liveSales=sales.filter(x=>belongsToActiveTrade(x));
  const livePromotions=promotions.filter(x=>safeJson(x.conditions)?.kind==='scheduledPrice'||belongsToActiveTrade(x));
  const liveTillChecks=tillChecks.filter(x=>activeTradeStart!==null&&(x.float_id===latestMain.id||belongsToActiveTrade(x,'checked_at')));
  const liveCashMovements=cashMovements.filter(x=>belongsToActiveTrade(x));
  const itemMap=items.reduce((m,x)=>((m[x.sale_id]??=[]).push({id:x.id,productId:x.product_id,name:x.product_name,price:pounds(x.line_total_pence),comp:x.discount_pence>=x.unit_price_pence}),m),{});
  const mappedSales=liveSales.map(x=>{const detail=safeJson(x.notes)||{};return {id:x.id,transactionId:String(x.sale_number).padStart(4,'0'),date:new Date(x.created_at).toLocaleString('en-GB'),by:staff.find(s=>s.id===x.created_by)?.display_name||'Staff',method:x.payment_method==='cash'?'Cash':x.payment_method==='card'?'Card':x.payment_method==='mixed'?'Split':'Tab',cashPaid:pounds(detail.cashPaidPence??(x.payment_method==='cash'?x.total_pence:0)),cardPaid:pounds(detail.cardPaidPence??(x.payment_method==='card'?x.total_pence:0)),total:pounds(x.total_pence),items:itemMap[x.id]||[],source:x.customer_tab_id?'Customer tab':detail.source||'Counter sale',tabId:x.customer_tab_id,status:x.status,correctionReason:x.void_reason||x.refund_reason,correctedBy:staff.find(s=>s.id===(x.voided_by||x.refunded_by))?.display_name,correctedAt:x.voided_at||x.refunded_at}});
  const mappedPromotions=livePromotions.map(x=>({...safeJson(x.conditions),id:x.id,name:x.name,value:Number(x.value),startsAt:x.starts_at,endsAt:x.ends_at,active:x.active,date:new Date(x.created_at).toLocaleString('en-GB'),by:staff.find(s=>s.id===x.created_by)?.display_name||'Staff'}));
  return {
    users:staff.map(x=>({id:x.id,name:x.display_name,role:x.role==='cashier'?'Staff':'Manager',active:x.active,permissions:x.role==='cashier'?(x.permissions||[]):['stock','reports','products','staff','comp']})),
    products:products.map(x=>({id:x.id,sku:x.sku,name:x.name,price:pounds(x.price_pence),area:x.sales_area||'Drinks',sub:x.subcategory||x.category||'Other',stock:Number(x.stock_quantity),emoji:x.emoji||'✨',active:x.active,reorderLevel:Number(x.reorder_level||0),bestBefore:x.best_before_date||''})),
    sales:mappedSales, cashMatches:mappedPromotions.filter(x=>x.kind==='cashMatch'), bingoCredits:mappedPromotions.filter(x=>x.kind==='bingoCredit'),
    customerTabs:tabs.map(x=>{const openSale=mappedSales.find(s=>s.tabId===x.id&&s.status==='open');return {id:x.id,saleId:openSale?.id,customer:x.customer_name,item:x.reference||'',amount:pounds(x.balance_pence),date:new Date(x.opened_at).toLocaleString('en-GB'),by:staff.find(s=>s.id===x.opened_by)?.display_name||'Staff',closed:x.status!=='open',closedAt:x.closed_at,items:openSale?.items||[]}}),
    reports:reports.filter(x=>x.id!=='f1fd71a3-d585-4523-88a5-23814a8cb678').map(x=>{const extra=safeJson(x.notes);return {id:x.id,date:new Date(x.prepared_at).toLocaleString('en-GB'),by:staff.find(s=>s.id===x.prepared_by)?.display_name||'Manager',expected:pounds(x.gross_sales_pence),counted:pounds(x.cash_total_pence+x.card_total_pence),variance:pounds(x.cash_variance_pence),cash:pounds(x.cash_total_pence),card:pounds(x.card_total_pence),transactions:[],summary:[],locked:true,...extra}}),
    stockChecks:stockChecks.map(x=>({id:x.id,date:new Date(x.checked_at).toLocaleString('en-GB'),by:staff.find(s=>s.id===x.checked_by)?.display_name||'Staff',rows:Object.values(x.counts||{})})),
    tillChecks:liveTillChecks.map(x=>({id:x.id,date:new Date(x.checked_at).toLocaleString('en-GB'),by:staff.find(s=>s.id===x.checked_by)?.display_name||'Staff',...safeJson(x.notes)})),
    scheduledPromotions:mappedPromotions.filter(x=>x.kind==='scheduledPrice'),
    cashMovements:liveCashMovements.map(x=>({id:x.id,date:new Date(x.created_at).toLocaleString('en-GB'),area:x.area,type:x.movement_type,amount:pounds(x.amount_pence),reason:x.reason,by:staff.find(s=>s.id===x.created_by)?.display_name||'Manager'})),
    stockMovements:stockMovements.map(x=>({id:x.id,date:new Date(x.created_at).toLocaleString('en-GB'),productId:x.product_id,type:x.movement_type,quantity:Number(x.quantity_delta),reason:x.reason,by:staff.find(s=>s.id===x.created_by)?.display_name||'Staff'})),
    reportCorrections:reportCorrections.map(x=>({id:x.id,reportId:x.report_id,date:new Date(x.created_at).toLocaleString('en-GB'),reason:x.reason,correction:x.correction,by:staff.find(s=>s.id===x.created_by)?.display_name||'Manager'})),
    auditLogs:auditLogs.map(x=>({id:x.id,date:new Date(x.created_at).toLocaleString('en-GB'),actorId:x.actor_staff_id,by:staff.find(s=>s.id===x.actor_staff_id)?.display_name||'System',action:x.action,entity:x.entity_type,entityId:x.entity_id,reason:x.reason,changes:x.changes})),
    trade:latestMain?{status:latestMain.status,openedAt:new Date(latestMain.opened_at).toLocaleString('en-GB'),openedBy:staff.find(s=>s.id===latestMain.opened_by)?.display_name||'Staff',startingFloat:pounds(latestMain.opening_amount_pence),machineFloat:pounds(latestMachine?.opening_amount_pence),poolFloat:pounds(latestPool?.opening_amount_pence),floatIds:{main:latestMain.id,machine:latestMachine?.id,pool:latestPool?.id}}:{status:'closed',openedAt:null,openedBy:null,startingFloat:0,machineFloat:0,poolFloat:0}
  };
}

export async function syncState(state,actor){
  const staffId=actor.id;
  let r;
  if(actor.role==='Manager'){
    const pending=state.products.filter(x=>x.needsSync||!String(x.id).includes('-'));
    if(pending.length){
      const products=pending.map((x,i)=>({id:String(x.id).includes('-')?x.id:undefined,sku:x.sku||`POS-${String(x.id||i+1)}`,name:x.name,category:x.sub||null,sales_area:x.area||'Drinks',subcategory:x.sub||'Other',emoji:x.emoji||'✨',price_pence:pence(x.price),stock_quantity:Number(x.stock||0),track_stock:Number(x.stock||0)<900,active:x.active!==false,reorder_level:Number(x.reorderLevel||0),best_before_date:x.bestBefore||null})).map(x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined)));
      r=await supabase.from('products').upsert(products,{onConflict:'sku'}).select();if(r.error)fail(r.error);
      for(const saved of r.data||[]){const local=state.products.find(x=>x.sku===saved.sku);if(local)Object.assign(local,{id:saved.id,stock:Number(saved.stock_quantity),needsSync:false})}
    }
  }

  for(const x of [...state.cashMatches.map(v=>Object.assign(v,{kind:'cashMatch'})),...state.bingoCredits.map(v=>Object.assign(v,{kind:'bingoCredit'}))].filter(v=>v.needsSync||!String(v.id).includes('-'))){
    if(!String(x.id).includes('-'))x.id=uuid();
    r=await supabase.from('promotions').insert({id:x.id,name:x.kind==='cashMatch'?'Cash match voucher':'Bingo promo credit',promotion_type:'fixed_amount',value:Number(x.value||0),starts_at:new Date().toISOString(),active:true,conditions:{kind:x.kind,matchType:x.matchType,customer:x.customer,member:x.member,position:x.position},created_by:staffId});if(r.error)fail(r.error);x.needsSync=false;
  }
  for(const x of state.scheduledPromotions||[]){
    if(!x.needsSync&&String(x.id).includes('-'))continue;
    if(!String(x.id).includes('-'))x.id=uuid();
    r=await supabase.from('promotions').insert({id:x.id,name:x.name,promotion_type:'set_price',value:Number(x.value||0),starts_at:toIso(x.startsAt),ends_at:x.endsAt?toIso(x.endsAt):null,active:x.active!==false,conditions:{kind:'scheduledPrice',productId:x.productId,reason:x.reason||'Dated stock markdown'},created_by:staffId});if(r.error)fail(r.error);x.needsSync=false;
  }

  const localItemIds=[...state.customerTabs.flatMap(t=>t.items||[]),...state.sales.flatMap(s=>s.items||[])].map(x=>x.id).filter(id=>String(id).includes('-'));
  const existingItems=new Set();
  if(localItemIds.length){r=await supabase.from('transaction_items').select('id').in('id',localItemIds);if(r.error)fail(r.error);for(const row of r.data||[])existingItems.add(row.id)}

  for(const x of state.cashMovements||[]){if(!String(x.id).includes('-')){x.id=uuid();r=await supabase.from('cash_movements').insert({id:x.id,area:x.area,movement_type:x.type,amount_pence:pence(x.amount),reason:x.reason,created_by:staffId});if(r.error)fail(r.error)}}
  for(const x of state.stockMovements||[]){if(!String(x.id).includes('-')){x.id=uuid();r=await supabase.from('stock_movements').insert({id:x.id,product_id:x.productId,movement_type:x.type,quantity_delta:Number(x.quantity),reason:x.reason,created_by:staffId});if(r.error)fail(r.error)}}
  for(const x of state.reportCorrections||[]){if(!String(x.id).includes('-')){x.id=uuid();r=await supabase.from('report_corrections').insert({id:x.id,report_id:x.reportId,reason:x.reason,correction:x.correction||{},created_by:staffId});if(r.error)fail(r.error)}}

  for(const t of state.customerTabs){
    if(!String(t.id).includes('-'))t.id=uuid();
    r=await supabase.from('customer_tabs').upsert({id:t.id,customer_name:t.customer,reference:t.item||null,status:t.closed?'settled':'open',balance_pence:pence(t.amount),opened_by:staffId,closed_by:t.closed?staffId:null,opened_at:toIso(t.openedAt||t.date),closed_at:t.closed?toIso(t.closedAt):null,notes:null});if(r.error)fail(r.error);
    if(!t.closed&&(t.items||[]).length){
      t.saleId=t.saleId||uuid();
      r=await supabase.from('sales').upsert({id:t.saleId,status:'open',payment_method:'tab',customer_tab_id:t.id,subtotal_pence:pence(t.amount),discount_pence:0,tax_pence:0,total_pence:pence(t.amount),created_by:staffId,notes:'Open customer tab'});if(r.error)fail(r.error);
      for(const item of t.items){if(!String(item.id||'').includes('-'))item.id=uuid();if(existingItems.has(item.id))continue;const productId=state.products.some(p=>p.id===item.productId)?item.productId:null;r=await supabase.from('transaction_items').insert({id:item.id,sale_id:t.saleId,product_id:productId,product_name:item.name,quantity:1,unit_price_pence:pence(item.price),discount_pence:item.comp?pence(item.price):0,tax_pence:0,line_total_pence:item.comp?0:pence(item.price)});if(r.error)fail(r.error);existingItems.add(item.id)}
    }
  }

  const saleIds=state.sales.map(s=>s.id).filter(id=>String(id).includes('-'));
  const existingSales=new Map();
  if(saleIds.length){r=await supabase.from('sales').select('id,status').in('id',saleIds);if(r.error)fail(r.error);for(const row of r.data||[])existingSales.set(row.id,row.status)}
  for(const s of state.sales){
    if(!String(s.id).includes('-'))s.id=uuid();
    const method=String(s.method||'').toLowerCase();
    const status=['void','refunded'].includes(s.status)?s.status:'completed';
    const saleRow={id:s.id,status,payment_method:method==='cash'?'cash':method==='card'?'card':s.tabId?'tab':'mixed',customer_tab_id:s.tabId||null,subtotal_pence:pence(s.total),discount_pence:0,tax_pence:0,total_pence:pence(s.total),created_by:staffId,completed_by:staffId,completed_at:new Date().toISOString(),notes:JSON.stringify({source:s.source||'Counter sale',cashPaidPence:pence(s.cashPaid??(method==='cash'?s.total:0)),cardPaidPence:pence(s.cardPaid??(method==='card'?s.total:0))}),void_reason:status==='void'?s.correctionReason:null,voided_by:status==='void'?staffId:null,voided_at:status==='void'?new Date().toISOString():null,refund_reason:status==='refunded'?s.correctionReason:null,refunded_by:status==='refunded'?staffId:null,refunded_at:status==='refunded'?new Date().toISOString():null};
    const isNew=!existingSales.has(s.id);
    if(isNew){r=await supabase.from('sales').insert(saleRow);if(r.error)fail(r.error);existingSales.set(s.id,status)}
    else if((s.tabId&&existingSales.get(s.id)==='open')||(['void','refunded'].includes(status)&&existingSales.get(s.id)!==status)){r=await supabase.from('sales').update(saleRow).eq('id',s.id);if(r.error)fail(r.error);existingSales.set(s.id,status)}
    for(const item of s.items||[]){if(!String(item.id||'').includes('-'))item.id=uuid();if(existingItems.has(item.id))continue;const productId=state.products.some(p=>p.id===item.productId)?item.productId:null;r=await supabase.from('transaction_items').insert({id:item.id,sale_id:s.id,product_id:productId,product_name:item.name,quantity:1,unit_price_pence:pence(item.originalPrice??item.price),discount_pence:item.comp?pence(item.originalPrice??item.price):0,tax_pence:0,line_total_pence:item.comp?0:pence(item.price)});if(r.error)fail(r.error);existingItems.add(item.id)}
  }

  if(state.trade?.status==='open'&&(state.trade.needsOpenSync||!state.trade.floatIds?.main)){
    const entries=[['main','Main Till',state.trade.startingFloat],['machine','Machine CM',state.trade.machineFloat],['pool','Pool',state.trade.poolFloat]];
    for(const [key,name,amount] of entries){const id=state.trade.floatIds?.[key]||uuid();state.trade.floatIds={...(state.trade.floatIds||{}),[key]:id};r=await supabase.from('floats').upsert({id,business_date:new Date().toISOString().slice(0,10),till_name:name,opening_amount_pence:pence(amount),status:'open',opened_by:staffId,opened_at:new Date().toISOString()},{onConflict:'business_date,till_name'}).select('id').single();if(r.error)fail(r.error);state.trade.floatIds[key]=r.data.id}state.trade.needsOpenSync=false;
  }
  if(state.trade?.status==='closed'&&state.trade.floatIds){
    const report=state.reports.at(-1),closing={main:report?.cash??state.trade.startingFloat,machine:report?.floats?.machineCounted??state.trade.machineFloat,pool:report?.floats?.poolCounted??state.trade.poolFloat};
    for(const [key,id] of Object.entries(state.trade.floatIds)){if(!id)continue;r=await supabase.from('floats').update({status:'closed',closing_amount_pence:pence(closing[key]),closed_by:staffId,closed_at:new Date().toISOString()}).eq('id',id);if(r.error)fail(r.error)}
  }
  for(const x of state.tillChecks){if(!String(x.id).includes('-'))x.id=uuid();r=await supabase.from('till_checks').upsert({id:x.id,float_id:state.trade.floatIds?.main,expected_amount_pence:pence(x.expected?.cash),counted_amount_pence:pence(x.actual?.cash),checked_by:staffId,notes:JSON.stringify({expected:x.expected,actual:x.actual,variances:x.variances})});if(r.error)fail(r.error)}
  for(const x of state.stockChecks){if(!String(x.id).includes('-'))x.id=uuid();r=await supabase.from('stock_checks').upsert({id:x.id,status:'submitted',counts:Object.fromEntries((x.rows||[]).map((v,i)=>[String(i),v])),checked_by:staffId,notes:'Tuesday–Monday stock check'});if(r.error)fail(r.error)}
  for(const x of state.reports){if(!String(x.id).includes('-')){x.id=uuid();r=await supabase.from('end_of_trade_reports').insert({id:x.id,business_date:new Date().toISOString().slice(0,10),gross_sales_pence:pence(x.expected),net_sales_pence:pence(x.expected),cash_total_pence:pence(x.cash),card_total_pence:pence(x.card),expected_cash_pence:pence(x.cash),counted_cash_pence:pence(x.cash),sales_count:(x.transactions||[]).length,prepared_by:staffId,notes:JSON.stringify({transactions:x.transactions||[],summary:x.summary||[],customerTabsSummary:x.customerTabsSummary||[],promotions:x.promotions,floats:x.floats,tillChecks:x.tillChecks||[],cashMatches:x.cashMatches||[],bingoCredits:x.bingoCredits||[],cashMovements:x.cashMovements||[],openedAt:x.openedAt,openedBy:x.openedBy})});if(r.error)fail(r.error);x.locked=true}}
}

