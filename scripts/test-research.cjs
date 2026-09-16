const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const dir = mkdtempSync(join(tmpdir(),'wjr-research-'));
try {
  const compile = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc','lib/marketplaces/shopee/public-research.ts','lib/marketplaces/shopee/research-evidence.ts','lib/marketplaces/shopee/research-status.ts','lib/marketplaces/shopee/market-research.ts','--outDir',dir,'--module','commonjs','--target','es2022','--skipLibCheck','--strict'],{stdio:'inherit'});
  if (compile.status !== 0) process.exitCode=compile.status || 1;
  else {
    const test = spawnSync(process.execPath,['--test','tests/shopee-research.cjs'],{stdio:'inherit',env:{...process.env,WJR_RESEARCH_TEST_DIR:dir}});
    process.exitCode=test.status || 0;
  }
} finally { rmSync(dir,{recursive:true,force:true}); }
