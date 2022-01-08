const { ApolloServer, gql } = require('apollo-server')
const { v1 } = require('uuid')
const _ = require('lodash')

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
    author: String!
    genres: [String!]!
    id: ID!
  }
  type Author {
    name: String!
    born: Int
    bookCount: Int
    id: ID!
  }
  type Query {
    allAuthors:[Author!]!
    authorCount:Int!

    allBooks(author:String,genre:String):[Book]!
    bookCount(author:String):Int!

  }
  type Mutation {
    addBook(
      title:String!,
      published:Int!,
      author:String!,
      genres:[String!]!
    ):Book!
    editAuthor(
      name:String!,
      setBornTo:Int!
    ):Author
  }
`

const resolvers = {
  Query: {
    authorCount: () => authors.length,
    allAuthors: () => {
      const a = [...authors]
      const bookCounts = _.countBy(books,'author')
      const authorsAndBookCounts = a.map(author => {
        const ab = { ...author,bookCount:bookCounts[author.name] }
        return ab
      })
      return authorsAndBookCounts
    },
    bookCount: (root,args) => {
      if(args.author) {
        const counts = _.countBy(books,'author')
        const count = counts[args.author] || 0
        return count
      }
      return books.length
    },
    allBooks: (root,args) => {
      let filteredBooks = books
      if(args.author) {
        const groupedBooks = _.groupBy(filteredBooks,'author')
        filteredBooks = groupedBooks[args.author]
      }
      if(args.genre) {
        const groupedBooks = _.groupBy(filteredBooks,book => {
          return book.genres.includes(args.genre)
        })
        filteredBooks = groupedBooks[true]
      }      
      return filteredBooks
    }
  },
  Mutation: {
    addBook: (root,args) => {
      const book = { ...args,id:v1()}
      books = books.concat(book)
      const authorNames = _.uniq(_.map(authors,'name'))
      if(!authorNames.includes(args.author)) {
        const newAuthor = {
          name: args.author,
          born: null,
          id: v1()
        }
        authors = authors.concat(newAuthor)
      }
      return book
    },
    editAuthor: (root,args) => {
      const author = authors.find(author => author.name===args.name)
      if(author) {
        author.born = args.setBornTo
        return author
      }
      return null
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

server.listen().then(({ url }) => {
  console.log(`Server ready at: ${url}`)
})
