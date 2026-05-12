export interface Member {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  cardNumber?: string;
  birthDate?: string;
  email?: string;
  password?: string;
  joinDate?: string;
  status: 'active' | 'inactive';
}

export interface Supplier {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  contactPerson?: string;
}

export interface Item {
  id?: string;
  name: string;
  category?: string;
  unit?: string;
  price: number;
  stock: number;
  supplierId?: string;
}

export interface Saving {
  id?: string;
  memberId: string;
  date: string;
  amount: number;
  type: 'pokok' | 'wajib' | 'sukarela';
}

export interface Loan {
  id?: string;
  memberId: string;
  date: string;
  amount: number;
  interest: number;
  totalPayable: number;
  durationMonths: number;
  remainingAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  type: 'cash' | 'goods';
}

export interface Transaction {
  id?: string;
  date: string;
  type: 'purchase' | 'sale';
  paymentMethod: 'cash' | 'credit';
  memberId?: string;
  supplierId?: string;
  totalAmount: number;
  items: Array<{
    itemId: string;
    name?: string;
    qty: number;
    price: number;
  }>;
}
