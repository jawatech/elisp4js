(defvar features )

(defun provide (feature) (if (not (member feature features)) (setq features (cons feature features))))

(defun featurep (feature) (member feature features))