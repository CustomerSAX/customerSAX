import { GraphQLScalarType, Kind } from "graphql";

export const jsonScalar = new GraphQLScalarType({
  name: "Json",
  parseLiteral: parseJsonLiteral,
  parseValue: (value) => value,
  serialize: (value) => value
});

function parseJsonLiteral(ast: import("graphql").ValueNode): unknown {
  switch (ast.kind) {
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.FLOAT:
    case Kind.INT:
      return Number(ast.value);
    case Kind.LIST:
      return ast.values.map(parseJsonLiteral);
    case Kind.NULL:
      return null;
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((field) => [field.name.value, parseJsonLiteral(field.value)]));
    case Kind.STRING:
      return ast.value;
    default:
      return null;
  }
}
