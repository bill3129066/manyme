import { Hono } from 'hono'
import { getModelCatalog } from '../services/agent/modelCatalog.js'

export const modelsRoutes = new Hono()
modelsRoutes.get('/', async c => {
  c.header('Cache-Control','no-store')
  try { return c.json(await getModelCatalog()) }
  catch(error:any) { return c.json({error:error.message || 'Unable to load models'},503) }
})
