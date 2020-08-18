const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const conectarDB = require('./config/db');
const jwt = require('jsonwebtoken');

// Conectar a la BBDD
conectarDB();

// servidor
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ ref }) => {
    const token = req.headers['authorization'] || '';
    if (token) {
      try {
        const usuario = await jwt.verify(token, process.env.SECRETA);
        return {
          usuario
        }
      } catch (error) {
        console.log(error)
      }
    }
  }
});

// Arrancar el servidor
server.listen().then(({ url }) => {
  console.log(`Servidor listo en la URL ${url}`);
});
