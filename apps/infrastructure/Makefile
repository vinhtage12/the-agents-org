SHELL := /bin/sh
.DEFAULT_GOAL := help
ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
ENV_TAGS := $(filter --%,$(MAKECMDGOALS))

.PHONY: help $(ENV_TAGS)

help:
	@echo 'Usage: make <up|down|remove>-<service> -- --<environment>'
$(ENV_TAGS):
	@:

up-% down-% remove-%:
	@python3 "$(ROOT)compose.py" "$@" $(ENV_TAGS)
