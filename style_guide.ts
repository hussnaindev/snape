// /**
//  * INTERFACES
//  */
// interface IUser {
//     id: string;
//     name: string;
//     email: string;
//   }
  
//   interface IOrder {
//     id: string;
//     userId: string;
//     amount: number;
//     status: "pending" | "paid";
//   }
  
//   interface IPaymentGateway {
//     processPayment(amount: number): Promise<boolean>;
//   }
  
//   /**
//    * DECORATOR
//    */
//   const HandleErrors = () => {
//     return (
//       target: object,
//       propertyKey: string,
//       descriptor: PropertyDescriptor
//     ): PropertyDescriptor => {
//       const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
  
//       descriptor.value = async function (...args: unknown[]) {
//         try {
//           return await original.apply(this, args);
//         } catch (error: unknown) {
//           throw new Error(`[${propertyKey}] ${(error as Error).message}`);
//         }
//       };
  
//       return descriptor;
//     };
//   };
  
//   /**
//    * VALIDATOR UTILITY
//    */
//   class Validator {
//     static isValidEmail = (email: string): boolean =>
//       email.includes("@") && email.length > 5;
  
//     static isValidAmount = (amount: number): boolean => amount > 0;
//   }
  
//   /**
//    * PAYMENT GATEWAY SERVICE
//    */
//   class PaymentGateway implements IPaymentGateway {
//     /**
//      * Simulates external payment processing
//      */
//     processPayment = async (amount: number): Promise<boolean> =>
//       amount < 10000;
//   }
  
//   /**
//    * USER SERVICE
//    */
//   class UserService {
//     private users: IUser[] = [];
  
//     /**
//      * Creates a validated user entity
//      */
//     createUser = (id: string, name: string, email: string): IUser => {
//       if (!Validator.isValidEmail(email)) {
//         throw new Error("Invalid email");
//       }
  
//       return { id, name, email };
//     };
  
//     /**
//      * Adds a user immutably
//      */
//     addUser = (user: IUser): void => {
//       this.users = [...this.users, user];
//     };
  
//     /**
//      * Returns all users
//      */
//     getUsers = (): IUser[] => [...this.users];
//   }
  
//   /**
//    * ORDER SERVICE
//    */
//   class OrderService {
//     private orders: IOrder[] = [];
  
//     constructor(private paymentGateway: IPaymentGateway) {}
  
//     /**
//      * Creates a validated order
//      */
//     createOrder = (id: string, userId: string, amount: number): IOrder => {
//       if (!Validator.isValidAmount(amount)) {
//         throw new Error("Invalid amount");
//       }
  
//       return { id, userId, amount, status: "pending" };
//     };
  
//     /**
//      * Adds order immutably
//      */
//     addOrder = (order: IOrder): void => {
//       this.orders = [...this.orders, order];
//     };
  
//     /**
//      * Processes payment and updates order status
//      */
//     @HandleErrors()
//     processOrderPayment = async (orderId: string): Promise<IOrder> => {
//       const order = this.orders.find((o) => o.id === orderId);
  
//       if (!order) {
//         throw new Error("Order not found");
//       }
  
//       const success = await this.paymentGateway.processPayment(order.amount);
  
//       if (!success) {
//         throw new Error("Payment failed");
//       }
  
//       const updated = { ...order, status: "paid" };
  
//       this.orders = this.orders.map((o) =>
//         o.id === orderId ? updated : o
//       );
  
//       return updated;
//     };
//   }
  
//   /**
//    * APPLICATION CONTROLLER
//    */
//   class AppController {
//     private userService = new UserService();
  
//     private orderService = new OrderService(new PaymentGateway());
  
//     /**
//      * Runs a real-world flow: user creation → order → payment
//      */
//     run = async (): Promise<void> => {
//       const user = this.userService.createUser(
//         "u1",
//         "Ali",
//         "ali@example.com"
//       );
  
//       this.userService.addUser(user);
  
//       const order = this.orderService.createOrder(
//         "o1",
//         user.id,
//         5000
//       );
  
//       this.orderService.addOrder(order);
  
//       const paidOrder = await this.orderService.processOrderPayment(
//         order.id
//       );
  
//       console.log("Paid Order:", paidOrder);
//     };
//   }
  
//   /**
//    * EXECUTION
//    */
//   const app = new AppController();
  
//   app.run();