const WordExtractor = require('word-extractor');
const fs = require('fs');
const http = require('http');
const buf = fs.readFileSync('/Users/ngrudinin/Projects/gazprom/smk-opencode/hahaton/ДИ_11_993_Упр_по_раб_с_перс_Отд_подб_и_адапт_перс_ГС_без_ПДн.doc');
const e = new WordExtractor();
function splitIntoSentences(text) {
  const sentences = []; let start = 0; const boundary = /[.!?。！？]/u;
  for (let i = 0; i < text.length; i++) {
    if (!boundary.test(text[i])) continue;
    const char = text[i]; const prev = text[i-1]||''; const next = text[i+1]||'';
    const afterNextNonSpace = text.slice(i+1).match(/\S/)?.[0]||'';
    if (char === '.' && ((!/\s/.test(next) && !/[\u3000-\u9fff\uac00-\ud7af]/.test(next)) || (/[A-Za-z0-9]/.test(prev) && /[a-z0-9]/.test(afterNextNonSpace)))) continue;
    let end = i+1;
    const close = /["')\]}”’]/u;
    while (end < text.length && close.test(text[end])) end++;
    const sentence = text.slice(start,end).trim(); if (sentence) sentences.push(sentence);
    start = end; while (start < text.length && /\s/u.test(text[start])) start++; i = start-1;
  }
  const tail = text.slice(start).trim(); if (tail) sentences.push(tail);
  return sentences;
}
function embedBatch(inputs){return new Promise(res=>{
 const d=JSON.stringify({model:'qwen3-embedding:0.6b',input:inputs});
 const req=http.request({host:'localhost',port:11434,path:'/api/embed',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res({status:r.statusCode,body:b.slice(0,150)}));});
 req.on('error',e=>res({status:'ERR',body:e.message}));req.write(d);req.end();
});}
e.extract(buf).then(async doc=>{
  const sents = splitIntoSentences(doc.getBody());
  // embed whole sentence list (as semanticChunkText would for the big section)
  const r = await embedBatch(sents);
  console.log('FULL BATCH:', sents.length, '->', r.status, r.body);
  // retry a few times
  for(let i=0;i<5;i++){
    const r2 = await embedBatch(sents);
    console.log('retry', i, r2.status);
  }
});
