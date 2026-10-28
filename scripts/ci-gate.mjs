// An always-running required job must reject failed, cancelled and skipped dependencies.
const result=process.argv[2];
if(result!=='success'){
  console.error(`Journal checks did not succeed: ${result||'missing result'}`);
  process.exitCode=1;
}else console.log('Journal required checks passed.');
