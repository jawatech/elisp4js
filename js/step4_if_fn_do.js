if (typeof module !== 'undefined') {
    var types = require('./types');
    var readline = require('./node_readline');
    var reader = require('./reader');
    var printer = require('./printer');
    var Env = require('./env').Env;
    var core = require('./core');
}

// read
function READ(str) {
    return reader.read_str(str);
}

// eval
function eval_ast(ast, env) {
    if (types._symbol_Q(ast)) {
        return env.get(ast);
    } else if (types._list_Q(ast)) {
        return ast.map(function(a) { return EVAL(a, env); });
    } else if (types._vector_Q(ast)) {
        var v = ast.map(function(a) { return EVAL(a, env); });
        v.__isvector__ = true;
        return v;
    } else if (types._hash_map_Q(ast)) {
        var new_hm = {};
        for (k in ast) {
            new_hm[EVAL(k, env)] = EVAL(ast[k], env);
        }
        return new_hm;
    } else {
        return ast;
    }
}

function _EVAL(ast, env) {
    //printer.println("EVAL:", printer._pr_str(ast, true));
    if (!types._list_Q(ast)) {
        return eval_ast(ast, env);
    }

    // apply list
    var a0 = ast[0], a1 = ast[1], a2 = ast[2], a3 = ast[3];
    switch (a0.value) {
    case "def!":
        var res = EVAL(a2, env);
        return env.set(a1, res);
    case "let*":
        var let_env = new Env(env);
        for (var i=0; i < a1.length; i+=2) {
            let_env.set(a1[i], EVAL(a1[i+1], let_env));
        }
        return EVAL(a2, let_env);
    case "do":
        var el = eval_ast(ast.slice(1), env);
        return el[el.length-1];
    case "if":
        var cond = EVAL(a1, env);
        if (cond === null || cond === false) {
            return typeof a3 !== "undefined" ? EVAL(a3, env) : null;
        } else {
            return EVAL(a2, env);
        }
    case "fn*":
        return function() {
            return EVAL(a2, new Env(env, a1, arguments));
        };
    default:
        var el = eval_ast(ast, env), f = el[0];
        return f.apply(f, el.slice(1));
    }
}

function EVAL(ast, env) {
    var result = _EVAL(ast, env);
    return (typeof result !== "undefined") ? result : null;
}

// print
function PRINT(exp) {
    return printer._pr_str(exp, true);
}

// repl
var repl_env = new Env();
var rep = function(str) { return PRINT(EVAL(READ(str), repl_env)); };

// core.js: defined using javascript
for (var n in core.ns) { repl_env.set(types._symbol(n), core.ns[n]); }

// core.mal: defined using the language itself
rep("(def! not (fn* (a) (if a false true)))");

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
