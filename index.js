
const { ApolloServer,UserInputError,AuthenticationError, gql } = require('apollo-server')
const { v1 } = require('uuid')
const _ = require('lodash')

const mongoose = require('mongoose')
const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')
const Token = require('./models/token')

const {MONGODB_URI} = require('./utils/config')
const { filter } = require('lodash')
const jwt = require('jsonwebtoken')
const JWT_SECRET = 'secret key'

const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

console.log('connecting to',MONGODB_URI)

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connecting to MongoDB:', error.message)
  })

let authors = [
  {
    name: 'Robert Martin',
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952,
  },
  {
    name: 'Martin Fowler',
    id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
    born: 1963
  },
  {
    name: 'Fyodor Dostoevsky',
    id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
    born: 1821
  },
  { 
    name: 'Joshua Kerievsky', // birthyear not known
    id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  },
  { 
    name: 'Sandi Metz', // birthyear not known
    id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  },
]

/*
 * Suomi:
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
 *
 * English:
 * It might make more sense to associate a book with its author by storing the author's id in the context of the book instead of the author's name
 * However, for simplicity, we will store the author's name in connection with the book
*/

let books = [
  {
    title: 'Clean Code',
    published: 2008,
    author: 'Robert Martin',
    id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Agile software development',
    published: 2002,
    author: 'Robert Martin',
    id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
    genres: ['agile', 'patterns', 'design']
  },
  {
    title: 'Refactoring, edition 2',
    published: 2018,
    author: 'Martin Fowler',
    id: "afa5de00-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Refactoring to patterns',
    published: 2008,
    author: 'Joshua Kerievsky',
    id: "afa5de01-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'patterns']
  },  
  {
    title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
    published: 2012,
    author: 'Sandi Metz',
    id: "afa5de02-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'design']
  },
  {
    title: 'Crime and punishment',
    published: 1866,
    author: 'Fyodor Dostoevsky',
    id: "afa5de03-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'crime']
  },
  {
    title: 'The Demon ',
    published: 1872,
    author: 'Fyodor Dostoevsky',
    id: "afa5de04-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'revolution']
  },
]

const typeDefs = gql`
  type Book {
    title: String!
    published: Int!
    author: Author
    genres: [String!]!
    id: ID!
  }
  type Author {
    name: String!
    born: Int
    bookCount: Int
    id: ID!
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    allAuthors:[Author!]!
    authorCount:Int!

    allBooks(author:String,genre:String):[Book]!
    bookCount(author:String):Int!

    me:User

  }
  type Mutation {
    addBook(
      title:String!,
      published:Int!,
      author:String!,
      genres:[String!]!
    ):Book
    editAuthor(
      name:String!,
      setBornTo:Int!
    ):Author
    createUser(
      username:String!
      favoriteGenre:String!
    ):User
    login(
      username:String!
      password:String!
    ):Token
  }
  type Subscription {
    bookAdded:Book!
  }
`


const popBookAuthor = async (book) => {
  await book.populate('author')
  if(!book.author) book.author = {id:'unknown_id',name:'unknown',born:0}
}


const resolvers = {
  Query: {
    authorCount: () => Author.collection.countDocuments(),
    allAuthors: async () => {
      const authors = await Author.find({})
      const books = await Book.find({})
      const bookCounts = _.countBy(books,book => book.author.toString())
      const authorsAndBookCounts = authors.map(author => {
        author = author.toObject()    
        const ab = { ...author,id:author._id.toString(),bookCount:bookCounts[author._id.toString()] || 0 }
        return ab
      })
      const users = await User.find({})
      return authorsAndBookCounts
    },
    /*bookCount: async (root,args) => {
      const filter = {}
      if(args.author) {
        const author = await Author.findOne({name:args.author})
        if(!author) return 0
        filter.author = author._id
      }
      const count = Book.count(filter)
      return count
    },*/
    allBooks: async (root,args) => {
      let filteredBooks = await Book.find({})
      if(args.author) {
        const author = await Author.findOne({name:args.author})
        if(author) {
          filteredBooks = _.filter(filteredBooks,{author:author._id})
        } else {
          filteredBooks = []
        }
      }
      if(args.genre) {
        filteredBooks = _.filter(filteredBooks,book => {
          return book.genres.includes(args.genre)
        })
      }
      for(fb of filteredBooks) await popBookAuthor(fb)     
      return filteredBooks
    },
    me: async (root,args,context) => {
      return context.currentUser
    }
  },
  Mutation: {
    addBook: async (root,args,context) => {
      if(!context.currentUser) {
        throw new AuthenticationError('not authenticated')
      }
      let author = await Author.findOne({name:args.author})
      if(!author) {
        author = new Author({
          name: args.author,
          born: null          
        })
        try {
          await author.save()
        } catch(error) {
          throw new UserInputError(error.message,{
            invalidArgs: args
          })
        }
      }
      const bookdata = {...args,author:author._id}
      const book = new Book(bookdata)
      try {
        const savedBook = await book.save()
        await popBookAuthor(savedBook)
        pubsub.publish('BOOK_ADDED', { bookAdded: savedBook })        
        return savedBook        
      } catch(error) {
        throw new UserInputError(error.message,{
          invalidArgs:args
        })
      }
    },
    editAuthor: async (root,args,context) => {
      if(!context.currentUser) {
        throw new AuthenticationError('not authenticated')
      }      
      let author = await Author.findOne({name:args.name})      
      if(author) {
        try {        
          author.born = args.setBornTo
          await author.save()
        } catch(error) {
          throw new UserInputError(error.message,{
            invalidArgs:args
          })
        }
        return author
      }
      return null
    },
    createUser: async (root,args) => {
      console.log('createuser',args)
      const user = new User(args)
      try {
        await user.save()
      } catch(error) {
        throw new UserInputError(error.message,{
          invalidArgs:args
        })
      }
      console.log('created user',user)
      return user
    },
    login: async (root,args) => {
      console.log('login',args)
      const user = await User.findOne({username:args.username})
      if(!user || args.password!=='secret') {
        throw new UserInputError('wrong username or password')
      }
      const userForToken = {
        username: user.username,
        id: user._id
      }
      //console.log('userfortoken',userForToken)
      return { value: jwt.sign(userForToken,JWT_SECRET)}
    }
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(['BOOK_ADDED'])
    }
  }
}

const context = async ({req}) => {
  const auth = req ? req.headers.authorization : null
  if(auth && auth.toLowerCase().startsWith('bearer ')) {
    const userForToken = jwt.verify(auth.substring(7), JWT_SECRET)
    const currentUser = await (await User.findById(userForToken.id))
    return { currentUser}
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context
})

server.listen().then(({ url,subscriptionsUrl }) => {
  console.log(`Server ready at: ${url}`)
  console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})
