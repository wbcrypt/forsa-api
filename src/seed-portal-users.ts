import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as argon2 from 'argon2'
import { DataSource } from 'typeorm'

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule)
  const ds = app.get(DataSource)

  const hash = await argon2.hash('Admin2026Demo')
  
  await ds.query(`
    UPDATE users SET password_hash = $1 WHERE email = 'admin@forsa.tn'
  `, [hash])
  
  console.log('Password updated successfully')
  await app.close()
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
