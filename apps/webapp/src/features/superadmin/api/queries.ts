import { gql } from "@apollo/client";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const ADMIN_CLIENTS_QUERY = gql`
  query AdminClients {
    adminClients {
      id
      name
      slug
      contactEmail
      status
      projectCount
      userCount
      createdAt
    }
  }
`;

export const ADMIN_CLIENT_QUERY = gql`
  query AdminClient($id: ID!) {
    adminClient(id: $id) {
      id
      name
      slug
      contactEmail
      status
      createdAt
      createdBy
      ssoConfig {
        provider
        issuer
        clientId
        providerDisplayName
        extraScopes
        authorizeConnection
        oidcClientSecretSet
        entryPointUrl
        idpCertSet
      }
    }
    adminProjectsByClient(clientId: $id) {
      id
      clientId
      platform
      projectKey
      displayName
      ctApiUrl
      ctAuthUrl
      ctClientId
      ctClientSecretMasked
      scopes
      smtpProfileId
      standaloneB2cEnabled
      standaloneB2bEnabled
      shopifyStoreDomain
      shopifyApiVersion
      bigcommerceStoreHash
      bigcommerceClientId
      createdAt
    }
    adminUsersByClient(clientId: $id) {
      id
      email
      firstName
      lastName
      role
      active
      clientProjects {
        projectKey
        role
      }
    }
    adminSmtpProfilesByClient(clientId: $id) {
      id
      clientId
      name
      smtpHost
      smtpPort
      smtpSecure
      smtpUser
      smtpPasswordMasked
      emailFrom
      isDefault
    }
  }
`;

export const ADMIN_CREATE_CLIENT = gql`
  mutation AdminCreateClient($name: String!, $contactEmail: String!, $slug: String) {
    adminCreateClient(name: $name, contactEmail: $contactEmail, slug: $slug) {
      id
    }
  }
`;

export const ADMIN_UPDATE_CLIENT = gql`
  mutation AdminUpdateClient($id: ID!, $name: String, $contactEmail: String, $ssoConfig: AdminSsoConfigInput) {
    adminUpdateClient(id: $id, name: $name, contactEmail: $contactEmail, ssoConfig: $ssoConfig) {
      id
    }
  }
`;

export const ADMIN_SET_CLIENT_STATUS = gql`
  mutation AdminSetClientStatus($id: ID!, $status: String!) {
    adminSetClientStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const ADMIN_CREATE_PROJECT = gql`
  mutation AdminCreateProject($clientId: ID!, $input: AdminProjectInput!, $createdBy: String!) {
    adminCreateProject(clientId: $clientId, input: $input, createdBy: $createdBy) {
      id
    }
  }
`;

export const ADMIN_UPDATE_PROJECT = gql`
  mutation AdminUpdateProject($id: ID!, $input: AdminProjectUpdateInput!) {
    adminUpdateProject(id: $id, input: $input) {
      id
    }
  }
`;

export const ADMIN_DELETE_PROJECT = gql`
  mutation AdminDeleteProject($id: ID!) {
    adminDeleteProject(id: $id)
  }
`;

export const ADMIN_TEST_PROJECT_CONNECTION = gql`
  mutation AdminTestProjectConnection($id: ID!) {
    adminTestProjectConnection(id: $id) {
      ok
      message
      scopes
      expiresIn
    }
  }
`;

export const ADMIN_TEST_PROJECT_CREDENTIALS = gql`
  mutation AdminTestProjectCredentials($input: AdminTestCredentialsInput!) {
    adminTestProjectCredentials(input: $input) {
      ok
      message
      scopes
      expiresIn
    }
  }
`;

// ---------------------------------------------------------------------------
// SMTP profiles
// ---------------------------------------------------------------------------

export const ADMIN_CREATE_SMTP_PROFILE = gql`
  mutation AdminCreateSmtpProfile($clientId: ID!, $input: AdminSmtpProfileInput!) {
    adminCreateSmtpProfile(clientId: $clientId, input: $input) {
      id
    }
  }
`;

export const ADMIN_UPDATE_SMTP_PROFILE = gql`
  mutation AdminUpdateSmtpProfile($id: ID!, $clientId: ID!, $input: AdminSmtpProfileUpdateInput!) {
    adminUpdateSmtpProfile(id: $id, clientId: $clientId, input: $input) {
      id
    }
  }
`;

export const ADMIN_DELETE_SMTP_PROFILE = gql`
  mutation AdminDeleteSmtpProfile($id: ID!, $clientId: ID!) {
    adminDeleteSmtpProfile(id: $id, clientId: $clientId)
  }
`;

export const ADMIN_TEST_SMTP_PROFILE = gql`
  mutation AdminTestSmtpProfile($id: ID!, $clientId: ID!, $to: String) {
    adminTestSmtpProfile(id: $id, clientId: $clientId, to: $to) {
      ok
      to
      message
    }
  }
`;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const ADMIN_CREATE_CLIENT_USER = gql`
  mutation AdminCreateClientUser($clientId: ID!, $input: AdminCreateUserInput!, $grantedBy: String!) {
    adminCreateClientUser(clientId: $clientId, input: $input, grantedBy: $grantedBy) {
      email
    }
  }
`;

export const ADMIN_ASSIGN_CLIENT_USER = gql`
  mutation AdminAssignClientUser($clientId: ID!, $input: AdminAssignUserInput!, $grantedBy: String!) {
    adminAssignClientUser(clientId: $clientId, input: $input, grantedBy: $grantedBy) {
      email
    }
  }
`;

export const ADMIN_UPDATE_CLIENT_USER = gql`
  mutation AdminUpdateClientUser($clientId: ID!, $input: AdminUpdateClientUserInput!, $grantedBy: String!) {
    adminUpdateClientUser(clientId: $clientId, input: $input, grantedBy: $grantedBy) {
      email
    }
  }
`;

export const ADMIN_REMOVE_USER_FROM_PROJECT = gql`
  mutation AdminRemoveUserFromProject($clientId: ID!, $email: String!, $projectKey: String!) {
    adminRemoveUserFromProject(clientId: $clientId, email: $email, projectKey: $projectKey)
  }
`;

export const ADMIN_REMOVE_USER_FROM_CLIENT = gql`
  mutation AdminRemoveUserFromClient($clientId: ID!, $email: String!) {
    adminRemoveUserFromClient(clientId: $clientId, email: $email)
  }
`;
