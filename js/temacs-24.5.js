﻿if (typeof module !== 'undefined') {
    var types = require('./types');
    var readline = require('./node_readline');
    var reader = require('./reader');
    var printer = require('./printer');
    var Env = require('./env').Env;
    var core = require('./core');
    var interop = require('./interop');
}
// debug
//var debug = true;
var debug = false;
// read
function READ(str) {
    return reader.read_str(str);
}

// eval
function is_pair(x) {
    return types._sequential_Q(x) && x.length > 0;
}

function quasiquote(ast) {
    if (!is_pair(ast)) {
        return [types._symbol("quote"), ast];
    } else if (types._symbol_Q(ast[0]) && ast[0].value === 'unquote') {
        return ast[1];
    } else if (is_pair(ast[0]) && ast[0][0].value === 'splice-unquote') {
        return [types._symbol("concat"),
                ast[0][1],
                quasiquote(ast.slice(1))];
    } else {
        return [types._symbol("cons"),
                quasiquote(ast[0]),
                quasiquote(ast.slice(1))];
    }
}

function is_macro_call(ast, env) {
    return types._list_Q(ast) &&
           types._symbol_Q(ast[0]) &&
           env.find(ast[0]) &&
           env.get(ast[0])._ismacro_;
}

function macroexpand(ast, env) {
    while (is_macro_call(ast, env)) {
        var mac = env.get(ast[0]);
        ast = mac.apply(mac, ast.slice(1));
    }
    return ast;
}

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
    while (true) {
    if (debug) printer.println("EVAL:", printer._pr_str(ast, true));
    if (!types._list_Q(ast)) {
        return eval_ast(ast, env);
    }

    // apply list
    ast = macroexpand(ast, env);
    if (!types._list_Q(ast)) {
        return eval_ast(ast, env);
    }

    var a0 = ast[0], a1 = ast[1], a2 = ast[2], a3 = ast[3];
    switch (a0.value) {
    case "defvar":
        if(!env.find(a1)){
                var res = EVAL(a2, env);
                env.set(a1, res);
        }
        return a1;
    case "setq":
        var res = EVAL(a2, env);
        return env.set(a1, res);
    case "let*":
        var let_env = new Env(env);
        for (var i=0; i < a1.length; i++) {
            var ota = types._obj_type(a1[i]);
            switch (ota) {
                case 'symbol': 
                    let_env.set(a1[i], null);
                case 'list':
                    let_env.set(a1[i][0], EVAL(a1[i][1], let_env));
            }
        }
        for (var i=2; i < ast.length-1; i++) {
            EVAL(ast[i], let_env);
        }
        ast = ast.length>2 ? ast[ast.length-1] : null;
        env = let_env;
        break;
    case "let":
        var let_env = env;
        var temp= [];
        for (var i=0; i < a1.length; i++) {
            var ota = types._obj_type(a1[i]);
            switch (ota) {
                case 'symbol': 
                    temp.push(null);
                case 'list':
                    temp.push(EVAL(a1[i][1], let_env));
            }
        }
        if (debug) printer.println("EVAL:let2 ", printer._pr_str(a0, true));
        for (var i=0; i < a1.length; i++) {
            var ota = types._obj_type(a1[i]);
            switch (ota) {
                case 'symbol': 
                    if (debug) printer.println("EVAL:let2:symbol ", printer._pr_str(a1, true));
                    let_env.set(a1[i], null);
                case 'list':
                    if (debug) printer.println("EVAL:let2:list ", printer._pr_str(a1, true));
                    let_env.set(a1[i][0], temp[i]);
            }
        }
        for (var i=2; i < ast.length-1; i++) {
            EVAL(ast[i], let_env);
        }
        ast = ast.length>2 ? ast[ast.length-1] : null;
        env = let_env;
        break;
    case "quote":
        return a1;
    case "quasiquote":
        ast = quasiquote(a1);
        break;
    case 'defmacro':
        var func = EVAL(a2, env);
        func._ismacro_ = true;
        return env.set(a1, func);
    case 'macroexpand':
        return macroexpand(a1, env);
    case "js*":
        return eval(a1.toString());
    case ".":
        var el = eval_ast(ast.slice(2), env),
            r = interop.resolve_js(a1.toString()),
            obj = r[0], f = r[1];
        var res = f.apply(obj, el);
        console.log("DEBUG3:", res);
        return interop.js_to_mal(res);
    case "try*":
        try {
            return EVAL(a1, env);
        } catch (exc) {
            if (a2 && a2[0].value === "catch*") {
                if (exc instanceof Error) { exc = exc.message; }
                return EVAL(a2[2], new Env(env, [a2[1]], [exc]));
            } else {
                throw exc;
            }
        }
    case "do":
        eval_ast(ast.slice(1, -1), env);
        ast = ast[ast.length-1];
        break;
    case "if":
        var cond = EVAL(a1, env);
        if (cond === null || cond === false) {
            ast = (typeof a3 !== "undefined") ? a3 : null;
        } else {
            ast = a2;
        }
        break;
    case "lambda":
        return types._function(EVAL, Env, a2, env, a1);
    case "defun":
        env.set(a1, types._function(EVAL, Env, a3, env, a2));
        return a1;
    default:
        if (debug) printer.println(' : '+printer._pr_str(ast,true));
        var el = eval_ast(ast, env), f = el[0];
        if (f.__ast__) {
            ast = f.__ast__;
            env = f.__gen_env__(el.slice(1));
        } else {
            return f.apply(f, el.slice(1));
        }
    }

    }
}

function EVAL(ast, env) {
    if (debug) printer.println(' : '+printer._pr_str(ast,true));
    if (debug) console.log("DEBUG: ", ast);

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
repl_env.set(types._symbol('eval'), function(ast) {
    return EVAL(ast, repl_env); });
repl_env.set(types._symbol('command-line-args'), []);
repl_env.set(types._symbol('load-path'), '../lisp');

// core.mal: defined using the language itself
rep("(setq *host-language* \"javascript\")")
rep("(setq not (lambda (a) (if a false true)))");
rep("(setq load-file (lambda (f) (eval (read-string (str \"(do \" (slurp f) \")\")))))");
rep("(setq load (lambda (f) (eval (read-string (str \"(do \" (slurp (concat f \".el\")) \")\")))))");
//rep("(setq defvar (lambda (f) (setq f nil)))");

//rep("(setq defun (lambda (n p f) (setq n (lambda (p) (f)))))");
// set-buffer dummy implementation
rep("(setq set-buffer (lambda (f) (message f)))");

rep("(defmacro cond (lambda (& xs) (if (> (count xs) 0) (list 'if (first xs) (if (> (count xs) 1) (nth xs 1) (throw \"odd number of forms to cond\")) (cons 'cond (rest (rest xs)))))))");
rep("(setq *gensym-counter* (atom 0))");
rep("(setq gensym (lambda [] (symbol (str \"G__\" (swap! *gensym-counter* (lambda [x] (+ 1 x)))))))");
rep("(defmacro or (lambda (& xs) (if (empty? xs) nil (if (= 1 (count xs)) (first xs) (let* ((condvar (gensym))) `(let* ((~condvar ~(first xs))) (if ~condvar ~condvar (or ~@(rest xs))))) ))))");

rep("(defvar features )");
rep("(setq provide (lambda (feature) (if (not (member feature features)) (setq features (cons feature features)))))");
rep("(setq featurep (lambda (feature) (member feature features)))");
if (typeof process !== 'undefined' && process.argv.length > 2) {
    repl_env.set(types._symbol('command-line-args'), process.argv); //.slice(3));
    rep('(load-file "' + process.argv[2] + '")');
//    process.exit(0);
}

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
