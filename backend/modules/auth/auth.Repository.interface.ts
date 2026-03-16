export interface IAuthRepository {
  findUserByEmail(email: string): Promise<any>;
  findUserById(id: string): Promise<any>;
  
  findAuthByUserIdAndProvider(userId: string, provider: string): Promise<any>;
  findAuthByProviderIdAndProvider(providerId: string, provider: string): Promise<any>;
  findAuthByResetToken(hashedToken: string, checkExpiry?: boolean): Promise<any>;
  
  updateAuthRecord(authId: string, updateData: Partial<any>): Promise<void>;
  
 
  
}