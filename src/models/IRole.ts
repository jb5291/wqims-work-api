export interface IWQIMSRole {
  ROLE_ID: string,
  ROLE: string,
  PERMISSIONS: {
    ADD_USER: number,
    EDIT_USER: number,
    DELETE_USER: number,
    ASSIGN_USER_ROLE: number,
    ADD_THRESHOLD: number,
    EDIT_THRESHOLD: number,
    DELETE_THRESHOLD: number,
    ADD_GROUP: number,
    ADD_GROUP_USER: number,
    ADD_GROUP_THRESHOLD: number,
    EDIT_GROUP: number,
    REMOVE_GROUP_USER: number,
    REMOVE_GROUP: number,
    REVIEW_ALERTS: number,
    ACKNOWLEDGE_ALERTS: number,
  }
}