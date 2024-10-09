// single line comment
export const TestConstant = "test";

/**
 * multi line comment
 */
export const TestFunction = () => "test";

/**
 * TestClass
 *
 * @since 0.0.1
 * @category Test
 * @author Somebody
 */
export class TestClass {
  public test = "test";

  constructor() {
    this.test = "test";
  }

  testMethod() {
    return "test";
  }
}

export const TestFunctionWithParams = (test: string) => `test: ${test}`;

export const TestFunctionWithCallback = (callback: (test: string) => void) => {
  callback("test");
};
