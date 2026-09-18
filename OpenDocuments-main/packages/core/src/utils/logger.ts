import chalk from 'chalk'

const symbols = {
  ok: chalk.green('[ok]'),
  fail: chalk.red('[!!]'),
  info: chalk.blue('[--]'),
  arrow: chalk.cyan('[->]'),
  wait: chalk.yellow('[..]'),
  ask: chalk.magenta('[??]'),
  skip: chalk.dim('[skip]'),
} as const

export const log = {
  ok: (msg: string) => console.log(`  ${symbols.ok} ${msg}`),
  fail: (msg: string) => console.log(`  ${symbols.fail} ${chalk.red(msg)}`),
  info: (msg: string) => console.log(`  ${symbols.info} ${msg}`),
  arrow: (msg: string) => console.log(`  ${symbols.arrow} ${chalk.cyan(msg)}`),
  wait: (msg: string) => console.log(`  ${symbols.wait} ${chalk.yellow(msg)}`),
  heading: (msg: string) => console.log(`\n  ${chalk.bold.white(msg)}\n  ${chalk.dim('─'.repeat(40))}`),
  dim: (msg: string) => console.log(`  ${chalk.dim(msg)}`),
  blank: () => console.log(),
}
