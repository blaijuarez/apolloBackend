const Usuario = require('../models/Usuario')
const Producto = require('../models/Producto')
const Cliente = require('../models/Cliente')
const Pedido = require('../models/Pedido')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

require('dotenv').config({ path: 'variables.env' })

const crearToken = (usuario, secreta, expiresIn) => {
  const { id, email, nombre, apellido } = usuario
  return jwt.sign(
    {
      id,
      email,
      nombre,
      apellido
    },
    secreta,
    { expiresIn }
  )
}

// Resolvers
const resolvers = {
  Query: {
    // Usuarios
    obtenerUsuario: async (_, data, ctx) => {
      return ctx.usuario
    },
    // Productos
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({})
        return productos
      } catch (error) {
        console.log(error)
      }
    },
    obtenerProducto: async (_, { id }) => {
      // revisar si existe
      const producto = await Producto.findById(id)
      if (!producto) {
        throw new Error('Producto no encontrado')
      }
      return producto
    },
    // Clientes
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({})
        return clientes
      } catch (error) {
        console.log(error)
      }
    },
    obtenerClientesVendedor: async (_, data, ctx) => {
      try {
        const clientes = await Cliente.find({
          vendedor: ctx.usuario.id.toString()
        })
        return clientes
      } catch (error) {
        console.log(error)
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      // revisar si existe
      const cliente = await Cliente.findById(id)
      if (!cliente) {
        throw new Error('Cliente no encontrado')
      }

      // Quien lo creo puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error('Acceso a cliente no autorizado')
      }
      return cliente
    },

    // Pedidos
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({})
        return pedidos
      } catch (error) {
        console.log(error)
      }
    },
    obtenerPedidosVendedor: async (_, data, ctx) => {
      try {
        const pedidos = await Pedido.find({ vendedor: ctx.usuario.id })
        return pedidos
      } catch (error) {
        console.log(error)
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      // Verificar si existe pedido
      const pedido = await Pedido.findById(id)
      if (!pedido) {
        throw new Error('Pedido no encontrado')
      }

      // Verificar quien lo creo
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error('Acceso a cliente no autorizado')
      }
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado })
      return pedidos
    },
    // Busquedas avanzadas
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: 'COMPLETADO' } },
        {
          $group: {
            _id: '$cliente',
            total: { $sum: '$total' }
          }
        },
        {
          $lookup: {
            from: 'clientes',
            localfield: '_id',
            foreignField: '_id',
            as: 'cliente'
          }
        },
        { $limit: 10 },
        { $sort: { total: -1 } }
      ])

      return clientes
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: 'COMPLETADO' } },
        {
          $group: {
            _id: '$vendedor',
            total: { $sum: '$total' }
          }
        },
        {
          $lookup: {
            from: 'usuarios',
            localfield: '_id',
            foreignField: '_id',
            as: 'vendedor'
          }
        },
        { $limit: 3 },
        { $sort: { total: -1 } }
      ])

      return vendedores
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({
        $text: { $search: texto }
      }).limit(10)

      return productos
    }
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input

      // Revisar si el usuario ya está registrado
      const existeUsuario = await Usuario.findOne({ email })

      if (existeUsuario) {
        throw new Error('El usuario ya está registrado')
      }

      try {
        // Hash del password
        const salt = bcrypt.genSaltSync(10)
        input.password = bcrypt.hashSync(password, salt)

        // Guardarlo en la DB
        const usuario = new Usuario(input)
        usuario.save()
        return usuario // guardarlo
      } catch (error) {
        console.log(error)
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input
      // Si el usuario existe
      const existeUsuario = await Usuario.findOne({ email })
      if (!existeUsuario) {
        throw new Error('El usuario no existe')
      }

      // Revisar si el password es correcto
      const passwordCorrecto = bcrypt.compareSync(
        password,
        existeUsuario.password
      )
      if (!passwordCorrecto) {
        throw new Error('El Password es Incorrecto')
      }

      // Crear Token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, '24h')
      }
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input)

        // almacenar bd
        const resultado = await producto.save()
        return resultado
      } catch (error) {
        console(error)
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      // revisar si existe
      let producto = await Producto.findById(id)
      if (!producto) {
        throw new Error('Producto no encontrado')
      }

      // guardar en la base de datos
      producto = producto.findOneAndUpdate({ _id: id }, input, { new: true })
      return producto
    },
    eliminarProducto: async (_, { id }) => {
      // revisar si existe
      const producto = await Producto.findById(id)
      if (!producto) {
        throw new Error('Producto no encontrado')
      }

      // eliminar de la base de datos
      await Producto.findByIdAndDelete({ _id: id })
      return 'Producto eliminado!'
    },

    // Clientes
    nuevoCliente: async (_, { input }, ctx) => {
      const { email } = input
      // Comprobar cliente
      const cliente = await Cliente.findOne({ email })
      if (cliente) {
        throw new Error('El cliente ya existe')
      }

      const nuevoCliente = new Cliente(input)

      // asignar el vendedor
      nuevoCliente.vendedor = ctx.usuario.id

      // guardarlo en la base de datos
      try {
        const resultado = await nuevoCliente.save()
        return resultado
      } catch (error) {
        console.log(error)
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      // revisar si existe
      let cliente = await Cliente.findById(id)
      if (!cliente) {
        throw new Error('Cliente no encontrado')
      }

      // Verificar vendedor
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error('Acceso a cliente no autorizado')
      }

      // guardar en la base de datos
      cliente = Cliente.findOneAndUpdate({ _id: id }, input, { new: true })
      return cliente
    },
    eliminarCliente: async (_, { id }, ctx) => {
      // revisar si existe
      const cliente = await Cliente.findById(id)
      if (!cliente) {
        throw new Error('Cliente no encontrado')
      }

      // Verificar vendedor
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error('Acceso a cliente no autorizado')
      }

      // eliminamos en la base de datos
      await Cliente.findByIdAndDelete({ _id: id })
      return 'Cliente eliminado'
    },

    // Pedidos
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente: id } = input

      // Verificar si existe
      const cliente = await Cliente.findById(id)
      if (!cliente) {
        throw new Error('Cliente no encontrado')
      }

      // Verificar si el cliente es del vendedor
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error('Acceso a cliente no autorizado')
      }

      // Revisar si el producto está en stock
      for await (const articulo of input.pedido) {
        const { id } = articulo
        const producto = await Producto.findById(id)
        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `No hay sufucientes existencias del articulo: ${producto.nombre}.`
          )
        } else {
          // restar las existencias
          producto.existencia = producto.existencia - articulo.cantidad
          await producto.save()
        }
      }

      // Crear nuevo pedido
      const nuevoPedido = new Pedido(input)

      // asignar a vendedor
      nuevoPedido.vendedor = ctx.usuario.id

      // guardar base de datos
      const resultado = await nuevoPedido.save()
      return resultado
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { pedido } = input
      // Si el pedido existe
      const existePedido = await Pedido.findById(id)
      if (!existePedido) {
        throw new Error('El pedido no existe')
      }

      // Si el cliente existe
      const existeCliente = await Pedido.findById(id)
      if (!existeCliente) {
        throw new Error('El cliente no existe')
      }

      // Si el cliente y el pedido pertenecen al vendedor
      if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error('Acceso a cliente no autorizado')
      }

      // Revisar el Stock
      if (pedido) {
        for await (const articulo of pedido) {
          const { id } = articulo
          const producto = await Producto.findById(id)
          if (articulo.cantidad > producto.existencia) {
            throw new Error(
              `No hay sufucientes existencias del articulo: ${producto.nombre}.`
            )
          } else {
            // restar las existencias
            producto.existencia = producto.existencia - articulo.cantidad
            await producto.save()
          }
        }
      }

      // Guardar el pedido
      const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, {
        new: true
      })
      return resultado
    },
    eliminarPedido: async (_, { id }, ctx) => {
      // revisar si existe
      const pedido = await Pedido.findById(id)
      if (!pedido) {
        throw new Error('El pedido no existe')
      }

      // Si el cliente y el pedido pertenecen al vendedor
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error('Acceso a cliente no autorizado')
      }

      // eliminamos en la base de datos
      await Pedido.findByIdAndDelete({ _id: id })
      return 'Pedido eliminado'
    }
  }
}

module.exports = resolvers
