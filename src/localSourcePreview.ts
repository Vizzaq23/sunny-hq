import type {LocalSourcePreview} from './shared';

/** Preserve full lines and source identity when a smaller conversation budget is used. */
export function fitLocalSourcePreview(preview:LocalSourcePreview,maxCharacters:number):LocalSourcePreview{
 const lines:string[]=[];let length=0;
 for(const line of preview.text.split('\n')){
  const next=length+(lines.length?1:0)+line.length;
  if(next>maxCharacters)break;
  lines.push(line);length=next;
 }
 if(!lines.length)throw Error('This source line is too long for this conversation. Choose another starting line or paste a focused excerpt.');
 const endLine=preview.startLine+lines.length-1;
 return {...preview,text:lines.join('\n'),endLine,truncated:preview.truncated||endLine<preview.endLine};
}
