// WordPress/Elementor entry point (esbuild bundles this into the shipped plugin). Self-executes:
// detects editor vs frontend and boots a single global HeaderApp instance.
import { HeaderApp } from './elementor/HeaderApp'
import { init } from './elementor/init'

init()

export default HeaderApp
