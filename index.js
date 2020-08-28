const { ApolloServer } = require('apollo-server')
const typeDefs = require('./db/schema')
const resolvers = require('./db/resolvers')
const conectarDB = require('./config/db')
const jwt = require('jsonwebtoken')

// Conectar a la BBDD
conectarDB()

// servidor
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const token = req.headers.authorization || ''
    if (token) {
      try {
        const usuario = await jwt.verify(
          token.replace('Bearer ', ''),
          process.env.SECRETA
        )
        return {
          usuario
        }
      } catch (error) {
        console.log(error)
      }
    }
  }
})

// Arrancar el servidor
server.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
  console.log(`Servidor listo en la URL ${url}`)
})
