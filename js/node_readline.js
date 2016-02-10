// IMPORTANT: choose one

var rlwrap = {}; // namespace for this module in web context

var  rl = require('readline').createInterface(process.stdin, process.stdout);
var cb;
var lines=[];    
rl.setPrompt('Emacgelion> ');
rl.prompt();
rl.on('line', function(line) {
    lines.push(line);
    cb((lines.length==0)?null:lines.shift());//theline;
    rl.prompt();
})

  .on('close', function() {
    console.log('bye bye');
    process.exit(0);
})
  .on('SIGINT', () => {
  rl.question('Are you sure you want to exit?', (answer) => {
    if (answer.match(/^y(es)?$/i)) rl.pause();
  });
});

exports.readline = rlwrap.readline = function(prompt, function_line) {
    prompt = prompt || "Emacgelion> ";
    cb=function_line;
    return null;
};

var readline = exports;
