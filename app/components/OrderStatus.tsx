type SavedOrder={gift_name?:string;recipient:string;email:string;phone:string;postal:string;address:string;note:string;status:string;tracking:string;updated_at?:string};
export default function OrderStatus({order,gift,language,busy,onRefresh}:{order:SavedOrder;gift?:{brand:string;name:string;image:string};language:'en'|'my';busy:boolean;onRefresh:()=>void}){
 const my=language==='my';
 const text=(en:string,mm:string)=>my?mm:en;
 const stages=[['Requested',text('Request received','ရွေးချယ်မှု လက်ခံရရှိပြီး')],['Ordered',text('Ordered from retailer','ဆိုင်တွင် မှာယူပြီး')],['Shipped',text('Shipped','ပို့ဆောင်နေပါသည်')],['Delivered',text('Delivered','ပို့ဆောင်ပြီး')]];
 const current=stages.findIndex(([value])=>value===order.status);
 return <section id="my-order" className="saved-order" aria-label={text('My gift and delivery progress','ရွေးထားသောလက်ဆောင်နှင့် ပို့ဆောင်မှုအခြေအနေ')}>
  <div className="saved-order-heading"><h2>{text('My gift & delivery progress','ရွေးထားသောလက်ဆောင်နှင့် ပို့ဆောင်မှုအခြေအနေ')}</h2><button className="outline" disabled={busy} onClick={onRefresh}>{busy?text('Checking…','စစ်ဆေးနေပါသည်…'):text('Refresh status','အခြေအနေ ပြန်စစ်ရန်')}</button></div>
  <div className="selected-summary">{gift&&<img src={gift.image} alt=""/>}<div><strong>{gift?gift.brand:order.gift_name||text('Your saved gift','သင်ရွေးထားသောလက်ဆောင်')}</strong>{gift&&<p>{gift.name}</p>}<p>{text('Quantity · 1','အရေအတွက် · ၁')}</p></div></div>
  <p role="status">{text('Delivery status','ပို့ဆောင်မှုအခြေအနေ')}: {stages[current]?.[1]||order.status}</p>
  <ol className="delivery-progress" aria-label={text('Delivery progress','ပို့ဆောင်မှုအဆင့်များ')}>{stages.map(([key,label],i)=><li key={key} className={current>=i?'reached':''} aria-current={current===i?'step':undefined}><span aria-hidden="true">{current>i?'✓':i+1}</span>{label}</li>)}</ol>
  {order.tracking&&<p>{text('Tracking reference','ပို့ဆောင်မှု ခြေရာခံနံပါတ်')}: <strong>{order.tracking}</strong></p>}
  <dl className="order-review">{[[text('Recipient','လက်ခံမည့်သူ'),order.recipient],[text('Email','အီးမေးလ်'),order.email],[text('Phone','ဖုန်းနံပါတ်'),order.phone],[text('Postcode','စာပို့သင်္ကေတ'),order.postal],[text('Delivery address','ပို့ဆောင်ရမည့်လိပ်စာ'),order.address],...(order.note?[[text('Delivery note','ပို့ဆောင်ရန်မှတ်ချက်'),order.note]]:[])].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  <p className="fine">{text('Updates appear when Htoo & May change the delivery status. Refresh this page to check the latest update.','Htoo နဲ့ May က ပို့ဆောင်မှုအခြေအနေကို ပြင်ဆင်တဲ့အခါ ဒီမှာ တွေ့ရပါမယ်။ နောက်ဆုံးအခြေအနေကို သိဖို့ ပြန်စစ်ပေးပါ။')}</p>
 </section>;
}
