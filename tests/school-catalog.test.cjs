'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../dist');
const script=name=>fs.readFileSync(path.join(root,name),'utf8');

async function loadParts(fail=false){
  const context={window:{},URL,setTimeout,clearTimeout,document:{currentScript:{src:'https://example.org/app/catalog-loader.js'},
    createElement(){return {};},head:{append(element){setTimeout(()=>{
      if(fail){element.onerror();return;}
      vm.runInContext(script(new URL(element.src).pathname.split('/').pop()),context);
      element.onload();
    },Math.random()*5);}}}};
  vm.createContext(context);
  vm.runInContext(script('catalog-loader.js'),context);
  return context.window.APP_CATALOG_READY;
}
test('out-of-order school downloads reconstruct the complete browser catalogue',async()=>{
  const original={window:{}};
  vm.runInNewContext(script('catalog.js'),original);
  const loaded=await loadParts();
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)),JSON.parse(JSON.stringify(original.window.APP_CATALOG)));
});
test('a failed school download rejects the complete catalogue',async()=>{
  await assert.rejects(loadParts(true),/未能下载/);
});
