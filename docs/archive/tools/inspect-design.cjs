const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1100,height:1050},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../docs/preview/design-directions-inspection.html')).href);
 const frame=page.frameLocator('iframe');
 await frame.locator('.vtd-stage').first().waitFor({state:'visible'});
 const count=await frame.locator('[data-variant]').count();
 if(count!==10)throw new Error('Expected 10 variants');
 const results=[];
 for(const width of [1024,768,390,320]){
  await page.setViewportSize({width,height:1500});
  for(let i=0;i<10;i++){
   await frame.locator('.viz-carousel').evaluate((el,index)=>{[...el.children].forEach((c,j)=>{if(c.hasAttribute('data-variant'))c.hidden=j!==index;});},i);
   const section=frame.locator('[data-variant]').nth(i);
   const metrics=await section.evaluate(el=>({name:el.dataset.variant,width:el.clientWidth,scroll:el.scrollWidth,stageHeight:el.querySelector('.vtd-stage').getBoundingClientRect().height}));
   if(metrics.scroll>metrics.width+1)throw new Error(`Overflow ${width}: ${JSON.stringify(metrics)}`);
   if(await section.locator('.vtd-assets svg').count()!==5)throw new Error('Asset samples missing');
   results.push({viewport:width,...metrics});
   if(width===1024)await section.screenshot({path:path.resolve(__dirname,`../docs/preview/direction-${String(i+1).padStart(2,'0')}.png`)});
  }
 }
 await page.setViewportSize({width:1100,height:1100});
 await frame.locator('.viz-carousel').evaluate(el=>{[...el.children].forEach((c,j)=>{if(c.hasAttribute('data-variant'))c.hidden=j!==0;});});
 const first=frame.locator('[data-variant]').first();
 await first.locator('[data-tower="포탑"]').click();
 if(await first.locator('.vtd-chosen').textContent()!=='포탑')throw new Error('Tower selection did not update');
 await first.locator('[data-answer="0"]').click();
 if(!(await first.locator('.vtd-feedback').textContent()).includes('맞았어요'))throw new Error('Answer feedback missing');
 await first.locator('.vtd-pause').click();
 if(!await first.locator('.vtd-options').evaluate(el=>el.inert))throw new Error('Pause input not blocked');
 await first.locator('.vtd-pause-cover button').click();
 if(await first.locator('.vtd-options').evaluate(el=>el.inert))throw new Error('Resume failed');
 await first.locator('.vtd-motion').click();
 await page.screenshot({path:path.resolve(__dirname,'../docs/preview/design-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:1500});
 await page.screenshot({path:path.resolve(__dirname,'../docs/preview/design-mobile.png'),fullPage:true});
 fs.writeFileSync(path.resolve(__dirname,'../docs/preview/inspection-report.json'),JSON.stringify({scope:'Design preview only, not game tests',variants:count,errors,checks:results,interactions:['tower select','answer feedback','pause','resume','motion trigger']},null,2));
 console.log(JSON.stringify({variants:count,layoutChecks:results.length,errors,interactions:5}));
 await browser.close();
 if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
