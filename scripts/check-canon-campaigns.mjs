import {spawnSync} from 'node:child_process';
for(const style of ['knife','club','sword','axe','hammer','spear']){const r=spawnSync(process.execPath,['scripts/check-canon-campaign.mjs'],{env:{...process.env,QA_STYLE:style,QA_QUIET:'1'},encoding:'utf8'});process.stdout.write(r.stdout);if(r.status){process.stderr.write(r.stderr);process.exit(r.status||1);}}
