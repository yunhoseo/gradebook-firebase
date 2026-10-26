import {build} from 'esbuild';
await build({entryPoints:['src/cloud.mjs'],outfile:'public/cloud.js',bundle:true,minify:true,format:'esm',target:['es2022']});
