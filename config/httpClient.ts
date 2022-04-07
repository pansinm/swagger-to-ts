type Method = "get" | "post" | "put" | "patch" | "options" | "delete";

interface HttpOptions {
  method: Method;
  url: string;
  body?: any;
  formData?: any;
  headers?: any;
}

type RequestHandler = (options: HttpOptions) => Promise<any>;

class HttpClient {
  private requestHandler?: RequestHandler;

  handleRequest(handler: RequestHandler) {
    this.requestHandler = handler;
  }

  request(url: string, method: Method, options: Partial<HttpOptions> = {}) {
    if (!this.requestHandler) {
      throw new Error(
        "no request handler， please use httpClient.handleRequest first"
      );
    }

    return this.requestHandler({
      method,
      url,
      ...options,
    });
  }

  get(url: string, config?: Partial<HttpOptions>) {
    return this.request(url, "get", config);
  }

  put(url: string, config?: Partial<HttpOptions>) {
    return this.request(url, "put", config);
  }

  post(url: string, config?: Partial<HttpOptions>) {
    return this.request(url, "post", config);
  }

  patch(url: string, config?: Partial<HttpOptions>) {
    return this.request(url, "patch", config);
  }

  options(url: string, config?: Partial<HttpOptions>) {
    return this.request(url, "options", config);
  }

  delete(url: string, config?: Partial<HttpOptions>) {
    return this.request(url, "delete", config);
  }
}

export default new HttpClient();