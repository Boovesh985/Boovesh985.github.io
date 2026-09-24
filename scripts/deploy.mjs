// Builds the site and publishes dist/ to the gh-pages branch (served by GitHub Pages).
import { execSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd })
const remote = execSync('git remote get-url origin').toString().trim()

run('npm run build')
writeFileSync('dist/.nojekyll', '')
rmSync('dist/.git', { recursive: true, force: true })
run('git init -q -b gh-pages', 'dist')
run('git add -A', 'dist')
run('git -c user.name="Boovesh985" -c user.email="boovesh985@gmail.com" commit -q -m "Deploy portfolio"', 'dist')
run(`git push -f ${remote} gh-pages`, 'dist')
rmSync('dist/.git', { recursive: true, force: true })
console.log('Deployed to gh-pages.')
