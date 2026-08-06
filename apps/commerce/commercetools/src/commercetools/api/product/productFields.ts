export const productFields = `#graphql
  id
  key
  masterData {
    current {
      nameAllLocales {
        value
      }
      descriptionAllLocales {
        value
      }
      slugAllLocales {
        value
      }
      masterVariant {
        sku
        images {
          url
        }
        prices {
          value {
            centAmount
            currencyCode
            fractionDigits
          }
        }
      }
    }
  }
`;
