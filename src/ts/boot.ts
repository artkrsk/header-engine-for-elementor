// WordPress/Elementor entry point (esbuild bundles this into the shipped plugin). Self-executes:
// detects editor vs frontend and boots a single global app instance.
import { createHeaderApp } from './elementor/createHeaderApp'
import { init } from './elementor/init'

init()

export default createHeaderApp
