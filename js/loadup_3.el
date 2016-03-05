(if (or (equal (nth 3 command-line-args) "bootstrap")
	(equal (nth 4 command-line-args) "bootstrap")
	;; FIXME this is irritatingly fragile.
	(equal (nth 4 command-line-args) "unidata-gen.el")
	(equal (nth 7 command-line-args) "unidata-gen-files")
	(if (fboundp 'dump-emacs)
	    (string-match "src/bootstrap-emacs" (nth 0 command-line-args))
	  t))
    (let ((dir (car load-path)))
      ;; We'll probably overflow the pure space.
      (setq purify-flag nil)
      (setq load-path (list (expand-file-name "." dir)
			    (expand-file-name "emacs-lisp" dir)
			    (expand-file-name "language" dir)
			    (expand-file-name "international" dir)
			    (expand-file-name "textmodes" dir)
			    (expand-file-name "vc" dir)))))

(if (eq t purify-flag)
    ;; Hash consing saved around 11% of pure space in my tests.
    (setq purify-flag (make-hash-table :test 'equal :size 70000)))

(message "Using load-path %s" load-path)

(if (or (member (nth 3 command-line-args) '("dump" "bootstrap"))
	(member (nth 4 command-line-args) '("dump" "bootstrap")))
    ;; To reduce the size of dumped Emacs, we avoid making huge
    ;; char-tables.
    (setq inhibit-load-charset-map t))

;; We don't want to have any undo records in the dumped Emacs.
(set-buffer "*scratch*")
(setq buffer-undo-list t)

(load "emacs-lisp/byte-run")
;(load "emacs-lisp/backquote")
