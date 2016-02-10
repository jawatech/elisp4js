if (typeof module !== 'undefined') {
    var types = require('./types');
    var readline = require('./node_readline');
    var reader = require('./reader');
    var printer = require('./printer');
}

// read
function READ(str) {
    return reader.read_str(str);
}

// eval
function EVAL(ast, env) {
    return ast;
}

// print
function PRINT(exp) {
    return printer._pr_str(exp, true);
}

// repl
var re = function(str) { return EVAL(READ(str), {}); };
var rep = function(str) { return PRINT(EVAL(READ(str), {})); };

// repl loop
if (typeof require !== 'undefined' && require.main === module) {
    // CLIP vvv ASynchronous node.js commandline mode
    var cb = function(line)
	{
	    //  ^^^ CLIP 
        try {
            if (line) { printer.println(rep(line)); }
        } catch (exc) {
            if (exc instanceof reader.BlankException) {} else //<<< CLIP 
            if (exc.stack) { printer.println(exc.stack); }
            else           { printer.println(exc); }
        }
    }
    var aline = readline.readline("user> ", cb); //<<< CLIP 
}
