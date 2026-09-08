import type {Data} from './model';
export type Envelope={data:Data;revision:number;pending:boolean};
const key='stone-delivery-v1';
export function readLocal():Envelope|null{try{const x=JSON.parse(localStorage.getItem(key)||'null');return x?.data?.task&&Array.isArray(x.data.customers)?x:null}catch{return null}}
export function writeLocal(e:Envelope){localStorage.setItem(key,JSON.stringify(e))}
