import "axios";

declare module "axios" {
  export interface AxiosResponse<T = any> {
    data: T;
  }
}
