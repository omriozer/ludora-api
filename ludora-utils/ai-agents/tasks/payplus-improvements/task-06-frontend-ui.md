# Task 06: Frontend Payment Method Management

## Task Header

**Task ID:** 06
**Title:** Frontend Payment Method Management
**Priority Level:** LOW (Final user experience layer)
**Estimated Time:** 4-5 hours AI work time
**Dependencies:** Task 05 (API Endpoints) must be complete
**Status:** Not Started

## Context Section

### Why This Task Is Needed

With the backend infrastructure complete, we need user-friendly interfaces that allow teachers to:
- View ALL payment methods (active and deleted shown with status)
- Select saved methods during checkout
- Set default payment methods (one at a time)
- Soft delete payment methods (even if it's their only one)
- NO "replace card" feature - only add/remove/set default

This completes the saved payment method feature, reducing checkout friction and improving conversion rates.

**Key UI Structure:**
- **My Account Page**: Small section showing only default/recent card + button to management page
- **Dedicated Payment Methods Page**: Full management interface for all operations

### Current State Analysis

```javascript
// Current: No UI for payment methods
// Teachers re-enter card details every purchase

// Needed: Two-tier UI structure
1. My Account Page:
   - Small section with current/default card (last 4 digits)
   - Button "ניהול אמצעי תשלום" → goes to dedicated page

2. Dedicated Payment Methods Page:
   - Show ALL payment methods (active + inactive with status)
   - Add new payment method button
   - Set default option
   - Delete existing methods (soft delete)
   - NO replace functionality
```

### Expected Outcomes

1. Complete React components for payment method management
2. Integration with backend APIs
3. Responsive design for mobile/desktop
4. Secure handling of payment data
5. Clear UX with proper error handling

### Success Criteria

- [ ] Users can view all saved payment methods
- [ ] Users can add/remove payment methods
- [ ] Users can select saved method at checkout
- [ ] UI properly handles all error states
- [ ] Mobile-responsive design

## Implementation Details

### Step-by-Step Implementation Plan

#### Step 1: Create My Account Page Section (Small Widget)

```jsx
// /ludora-front/src/components/Account/PaymentMethodWidget.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaCreditCard } from 'react-icons/fa';
import paymentMethodService from '../../services/paymentMethodService';

const PaymentMethodWidget = () => {
  const [defaultMethod, setDefaultMethod] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDefaultMethod();
  }, []);

  const loadDefaultMethod = async () => {
    try {
      const response = await paymentMethodService.getPaymentMethods();
      const activeDefault = response.payment_methods.find(
        m => m.is_default && m.status === 'active'
      );
      setDefaultMethod(activeDefault);
    } catch (error) {
      console.error('Failed to load payment method:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-3">
        <Card.Body className="text-center">
          <Spinner animation="border" size="sm" />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-3">
      <Card.Header>
        <h6 className="mb-0">אמצעי תשלום</h6>
      </Card.Header>
      <Card.Body>
        {defaultMethod ? (
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <FaCreditCard className="me-2" />
              <span>•••• {defaultMethod.card_last_4}</span>
              <small className="text-muted ms-2">
                ({defaultMethod.card_brand})
              </small>
            </div>
            <Link
              to="/account/payment-methods"
              className="btn btn-sm btn-outline-primary"
            >
              ניהול אמצעי תשלום
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-muted mb-2">אין אמצעי תשלום שמורים</p>
            <Link
              to="/account/payment-methods"
              className="btn btn-sm btn-primary"
            >
              ניהול אמצעי תשלום
            </Link>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default PaymentMethodWidget;
```

#### Step 2: Create Payment Method Service

```javascript
// /ludora-front/src/services/paymentMethodService.js
import api from './api';

class PaymentMethodService {
  /**
   * Get all payment methods for current user
   */
  async getPaymentMethods() {
    try {
      const response = await api.get('/payment-methods');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
      throw error;
    }
  }

  /**
   * Add new payment method
   */
  async addPaymentMethod(methodData) {
    try {
      const response = await api.post('/payment-methods', methodData);
      return response.data;
    } catch (error) {
      console.error('Failed to add payment method:', error);
      throw error;
    }
  }

  /**
   * Create payment method from recent purchase
   */
  async createFromPurchase(purchaseId) {
    try {
      const response = await api.post(`/payment-methods/from-purchase/${purchaseId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to create from purchase:', error);
      throw error;
    }
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(id, updates) {
    try {
      const response = await api.patch(`/payment-methods/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update payment method:', error);
      throw error;
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(id) {
    try {
      const response = await api.delete(`/payment-methods/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete payment method:', error);
      throw error;
    }
  }

  /**
   * Set payment method as default
   */
  async setDefaultPaymentMethod(id) {
    try {
      const response = await api.post(`/payment-methods/${id}/set-default`);
      return response.data;
    } catch (error) {
      console.error('Failed to set default payment method:', error);
      throw error;
    }
  }

  /**
   * Create payment with saved method
   */
  async createPaymentWithSaved(paymentMethodId, items, couponCode) {
    try {
      const response = await api.post('/payments/create-with-saved', {
        payment_method_id: paymentMethodId,
        items,
        coupon_code: couponCode
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create payment:', error);
      throw error;
    }
  }
}

export default new PaymentMethodService();
```

#### Step 3: Create Payment Method List Component (Shows ALL with Status)

```jsx
// /ludora-front/src/components/PaymentMethods/PaymentMethodList.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { FaCreditCard, FaTrash, FaStar, FaEdit } from 'react-icons/fa';
import paymentMethodService from '../../services/paymentMethodService';
import ConfirmDialog from '../Common/ConfirmDialog';

const PaymentMethodList = ({ onMethodSelect, selectable = false }) => {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await paymentMethodService.getPaymentMethods();
      // API returns ALL methods (active + deleted)
      setMethods(response.payment_methods);

      // Pre-select default method if in selection mode (only active ones)
      if (selectable) {
        const defaultMethod = response.payment_methods.find(
          m => m.is_default && m.status === 'active'
        );
        if (defaultMethod) {
          setSelectedMethod(defaultMethod.id);
          onMethodSelect?.(defaultMethod.id);
        }
      }
    } catch (err) {
      setError('Failed to load payment methods');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (methodId) => {
    try {
      await paymentMethodService.deletePaymentMethod(methodId);
      // Soft delete - update status instead of removing from list
      setMethods(methods.map(m =>
        m.id === methodId
          ? { ...m, status: 'deleted', is_default: false }
          : m
      ));
      setDeleteConfirm(null);
    } catch (err) {
      setError('Failed to delete payment method');
    }
  };

  const handleSetDefault = async (methodId) => {
    try {
      await paymentMethodService.setDefaultPaymentMethod(methodId);
      setMethods(methods.map(m => ({
        ...m,
        is_default: m.id === methodId
      })));
    } catch (err) {
      setError('Failed to set default payment method');
    }
  };

  const getCardIcon = (brand) => {
    const icons = {
      visa: '💳',
      mastercard: '💳',
      amex: '💳',
      discover: '💳',
      other: '💳'
    };
    return icons[brand] || '💳';
  };

  const formatExpiry = (month, year) => {
    // Display format: MM/YY only (no full year)
    return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" />
        <p>Loading payment methods...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" dismissible onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  if (methods.length === 0) {
    return (
      <Card className="text-center p-4">
        <Card.Body>
          <FaCreditCard size={48} className="text-muted mb-3" />
          <h5>No Payment Methods</h5>
          <p className="text-muted">
            You haven't saved any payment methods yet.
            They'll appear here after your first purchase.
          </p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <div className="payment-methods-list">
        {methods.map(method => (
          <Card
            key={method.id}
            className={`mb-3 ${selectable && selectedMethod === method.id ? 'border-primary' : ''}`}
            onClick={() => {
              if (selectable) {
                setSelectedMethod(method.id);
                onMethodSelect?.(method.id);
              }
            }}
            style={{ cursor: selectable ? 'pointer' : 'default' }}
          >
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex align-items-center">
                  {selectable && (
                    <input
                      type="radio"
                      className="me-3"
                      checked={selectedMethod === method.id}
                      onChange={() => {}}
                    />
                  )}
                  <div>
                    <div className="d-flex align-items-center mb-2">
                      {/* No card brand logo - just text display */}
                      <strong className="text-capitalize">{method.card_brand}</strong>
                      <span className="ms-2">•••• {method.card_last_4}</span>
                      {method.is_default && method.status === 'active' && (
                        <Badge bg="primary" className="ms-2">
                          ברירת מחדל
                        </Badge>
                      )}
                      {method.status === 'deleted' && (
                        <Badge bg="secondary" className="ms-2">
                          נמחק
                        </Badge>
                      )}
                    </div>
                    {method.nickname && (
                      <div className="text-muted small">{method.nickname}</div>
                    )}
                    <div className="text-muted small">
                      Expires {formatExpiry(method.card_exp_month, method.card_exp_year)}
                    </div>
                  </div>
                </div>

                {!selectable && method.status === 'active' && (
                  <div className="d-flex gap-2">
                    {!method.is_default && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        הגדר כברירת מחדל
                      </Button>
                    )}
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => setDeleteConfirm(method)}
                    >
                      <FaTrash />
                    </Button>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        show={!!deleteConfirm}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
        title="מחיקת אמצעי תשלום"
        message={`האם אתה בטוח שברצונך למחוק את כרטיס האשראי המסתיים ב-${deleteConfirm?.card_last_4}?`}
      />
    </>
  );
};

export default PaymentMethodList;
```

#### Step 3: Create Checkout Integration Component

```jsx
// /ludora-front/src/components/Checkout/PaymentMethodSelector.jsx
import React, { useState } from 'react';
import { Card, Button, Form, Collapse } from 'react-bootstrap';
import PaymentMethodList from '../PaymentMethods/PaymentMethodList';

const PaymentMethodSelector = ({ onMethodSelected, onNewCardSelected }) => {
  const [paymentOption, setPaymentOption] = useState('saved'); // 'saved' or 'new'
  const [selectedMethod, setSelectedMethod] = useState(null);

  const handleOptionChange = (option) => {
    setPaymentOption(option);
    if (option === 'new') {
      setSelectedMethod(null);
      onNewCardSelected?.();
    } else if (selectedMethod) {
      onMethodSelected?.(selectedMethod);
    }
  };

  const handleMethodSelect = (methodId) => {
    setSelectedMethod(methodId);
    onMethodSelected?.(methodId);
  };

  return (
    <Card className="payment-method-selector">
      <Card.Header>
        <h5>Payment Method</h5>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Check
            type="radio"
            id="use-saved"
            label="Use saved payment method"
            checked={paymentOption === 'saved'}
            onChange={() => handleOptionChange('saved')}
            className="mb-3"
          />

          <Collapse in={paymentOption === 'saved'}>
            <div className="ms-4 mb-3">
              <PaymentMethodList
                selectable={true}
                onMethodSelect={handleMethodSelect}
              />
            </div>
          </Collapse>

          <Form.Check
            type="radio"
            id="use-new"
            label="Use a new payment method"
            checked={paymentOption === 'new'}
            onChange={() => handleOptionChange('new')}
          />
        </Form>
      </Card.Body>
    </Card>
  );
};

export default PaymentMethodSelector;
```

#### Step 4: Create Save Payment Method Prompt

```jsx
// /ludora-front/src/components/PaymentMethods/SavePaymentMethodPrompt.jsx
import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import paymentMethodService from '../../services/paymentMethodService';

const SavePaymentMethodPrompt = ({
  show,
  onClose,
  purchaseId,
  cardInfo
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [nickname, setNickname] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Create from recent purchase
      await paymentMethodService.createFromPurchase(purchaseId);

      // If nickname or default was set, update
      if (nickname || setAsDefault) {
        // Note: Would need to get the created method ID from response
        // and then update it with nickname/default
      }

      onClose(true); // Close with success flag
    } catch (err) {
      setError('Failed to save payment method');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={() => onClose(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>Save Payment Method</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <p>Would you like to save this payment method for faster checkout next time?</p>

        {cardInfo && (
          <div className="bg-light p-3 rounded mb-3">
            <strong>{cardInfo.brand}</strong> ending in {cardInfo.last4}
            <br />
            <small className="text-muted">Expires {cardInfo.expiry}</small>
          </div>
        )}

        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Nickname (optional)</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., Personal Card"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
            />
            <Form.Text className="text-muted">
              Give this card a name to easily identify it later
            </Form.Text>
          </Form.Group>

          <Form.Check
            type="checkbox"
            label="Set as default payment method"
            checked={setAsDefault}
            onChange={(e) => setSetAsDefault(e.target.checked)}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={() => onClose(false)}
          disabled={saving}
        >
          No Thanks
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Payment Method'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SavePaymentMethodPrompt;
```

#### Step 5: Create Dedicated Payment Methods Management Page

```jsx
// /ludora-front/src/pages/Account/PaymentMethodsPage.jsx
import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Breadcrumb } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaPlus, FaArrowRight } from 'react-icons/fa';
import PaymentMethodList from '../../components/PaymentMethods/PaymentMethodList';

const PaymentMethodsPage = () => {
  return (
    <Container className="py-4">
      <Breadcrumb>
        <Breadcrumb.Item as={Link} to="/account">החשבון שלי</Breadcrumb.Item>
        <Breadcrumb.Item active>אמצעי תשלום</Breadcrumb.Item>
      </Breadcrumb>

      <Row>
        <Col lg={8} className="mx-auto">
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">ניהול אמצעי תשלום</h4>
              {/* Note: Add button only shows after first purchase/payment */}
            </Card.Header>
            <Card.Body>
              <div className="mb-3 text-muted">
                <small>
                  כאן תוכל לראות את כל אמצעי התשלום שלך, להגדיר כרטיס ברירת מחדל,
                  או למחוק כרטיסים שאינך צריך יותר.
                </small>
              </div>
              <PaymentMethodList />
              <div className="mt-3 text-center text-muted">
                <small>
                  אמצעי תשלום חדשים יתווספו אוטומטית לאחר רכישה מוצלחת
                </small>
              </div>
            </Card.Body>
          </Card>

          <div className="mt-4">
            <Link to="/account" className="btn btn-outline-secondary">
              <FaArrowRight className="me-2" />
              חזרה לחשבון שלי
            </Link>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default PaymentMethodsPage;
```

#### Step 6: Update Checkout Flow

```jsx
// /ludora-front/src/pages/Checkout/CheckoutPage.jsx (update existing)
import React, { useState } from 'react';
import PaymentMethodSelector from '../../components/Checkout/PaymentMethodSelector';
import paymentMethodService from '../../services/paymentMethodService';

const CheckoutPage = ({ cart, total }) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleCheckout = async () => {
    try {
      setProcessing(true);

      if (selectedPaymentMethod && !useNewCard) {
        // Use saved payment method
        const response = await paymentMethodService.createPaymentWithSaved(
          selectedPaymentMethod,
          cart.items,
          cart.coupon_code
        );

        if (response.success) {
          // Redirect to success page
          window.location.href = `/payment/success/${response.purchase_id}`;
        }
      } else {
        // Use new card (existing PayPlus flow)
        // ... existing implementation
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      // Handle error
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container>
      {/* ... existing checkout UI ... */}

      <Row>
        <Col md={8}>
          {/* Cart items display */}
        </Col>
        <Col md={4}>
          <PaymentMethodSelector
            onMethodSelected={setSelectedPaymentMethod}
            onNewCardSelected={() => setUseNewCard(true)}
          />

          <Button
            variant="primary"
            size="lg"
            className="w-100 mt-3"
            onClick={handleCheckout}
            disabled={processing || (!selectedPaymentMethod && !useNewCard)}
          >
            {processing ? 'Processing...' : `Pay ${formatPrice(total)}`}
          </Button>
        </Col>
      </Row>
    </Container>
  );
};
```

### Specific File Locations to Create/Modify

1. `/ludora-front/src/services/paymentMethodService.js` - New service
2. `/ludora-front/src/components/PaymentMethods/PaymentMethodList.jsx` - New component
3. `/ludora-front/src/components/Checkout/PaymentMethodSelector.jsx` - New component
4. `/ludora-front/src/components/PaymentMethods/SavePaymentMethodPrompt.jsx` - New component
5. `/ludora-front/src/pages/Account/PaymentMethodsPage.jsx` - New page
6. `/ludora-front/src/pages/Checkout/CheckoutPage.jsx` - Update existing
7. `/ludora-front/src/App.jsx` - Add route for payment methods page

### Component Specifications

#### PaymentMethodList Component
- **Props:** `selectable`, `onMethodSelect`
- **State:** Methods array, loading, error, selected method
- **Features:** Display cards, delete, set default, selection mode

#### PaymentMethodSelector Component
- **Props:** `onMethodSelected`, `onNewCardSelected`
- **State:** Payment option (saved/new), selected method
- **Features:** Toggle between saved and new card

#### SavePaymentMethodPrompt Modal
- **Props:** `show`, `onClose`, `purchaseId`, `cardInfo`
- **State:** Saving state, nickname, default flag
- **Features:** Save card after purchase, optional nickname

### User Flow Diagrams

```
1. First-time Purchase Flow:
   Checkout → New Card → Payment → Success → Save Prompt → Saved

2. Returning Customer Flow:
   Checkout → Select Saved → Payment → Success

3. Management Flow:
   Account → Payment Methods → View/Edit/Delete → Confirm
```

### State Management Requirements

```javascript
// Redux slice for payment methods (if using Redux)
const paymentMethodsSlice = createSlice({
  name: 'paymentMethods',
  initialState: {
    methods: [],
    loading: false,
    error: null,
    defaultMethodId: null
  },
  reducers: {
    setMethods: (state, action) => {
      state.methods = action.payload;
      state.defaultMethodId = action.payload.find(m => m.is_default)?.id;
    },
    addMethod: (state, action) => {
      state.methods.push(action.payload);
    },
    removeMethod: (state, action) => {
      state.methods = state.methods.filter(m => m.id !== action.payload);
    },
    setDefault: (state, action) => {
      state.methods.forEach(m => {
        m.is_default = m.id === action.payload;
      });
      state.defaultMethodId = action.payload;
    }
  }
});
```

## Technical Specifications

### Security Requirements

1. **No Sensitive Data in Frontend:**
   - Never store or display full tokens
   - Only show last 4 digits of cards
   - No card numbers in browser storage

2. **HTTPS Only:**
   - All payment-related pages must use HTTPS
   - Redirect HTTP to HTTPS automatically

3. **Input Validation:**
   - Validate card expiry dates
   - Sanitize user inputs (nicknames)
   - Prevent XSS in displayed data

4. **Session Security:**
   - Require re-authentication for sensitive actions
   - Timeout sessions after inactivity

### Testing Requirements

```javascript
// Component tests
describe('PaymentMethodList', () => {
  test('displays payment methods', () => {
    const methods = [mockPaymentMethod];
    render(<PaymentMethodList methods={methods} />);
    expect(screen.getByText('•••• 4242')).toBeInTheDocument();
  });

  test('handles delete confirmation', () => {
    // Test delete flow
  });

  test('sets default method', () => {
    // Test default selection
  });
});

describe('CheckoutFlow', () => {
  test('selects saved payment method', () => {
    // Test saved method selection
  });

  test('falls back to new card', () => {
    // Test new card option
  });
});
```

### Performance Considerations

- Lazy load payment method components
- Cache payment methods in session storage
- Debounce API calls
- Optimistic UI updates for better UX

## Completion Checklist

### Implementation
- [ ] Created payment method service
- [ ] Created list component
- [ ] Created selector component
- [ ] Created save prompt modal
- [ ] Created settings page
- [ ] Updated checkout flow

### Testing
- [ ] Component unit tests
- [ ] Service integration tests
- [ ] End-to-end checkout test
- [ ] Error state testing
- [ ] Mobile responsive testing

### Security
- [ ] No sensitive data exposed
- [ ] HTTPS enforced
- [ ] Input validation complete
- [ ] XSS prevention verified

### UX/UI
- [ ] Mobile responsive
- [ ] Loading states
- [ ] Error messages clear
- [ ] Success feedback
- [ ] Accessibility compliant

### Documentation
- [ ] Component documentation
- [ ] User guide written
- [ ] Integration notes
- [ ] Troubleshooting guide

## Notes for Next Session

If implementing this task:
1. Start with the service layer to test API integration
2. Build components incrementally, test each one
3. Use React DevTools to verify state management
4. Test on multiple screen sizes
5. Consider adding animations for better UX
6. Implement proper error boundaries
7. Add analytics tracking for conversion metrics

## Key Updates from User Clarifications

### UI Structure
- **Two-tier approach**: Small widget in My Account + dedicated management page
- **My Account widget**: Shows only default card + button to full page
- **Management page**: Full interface with all operations

### Display Requirements
- **Show ALL methods**: Both active and deleted (with status badges)
- **Hebrew UI**: Delete confirmation, default indicator, buttons
- **Card format**: MM/YY only, no logos, just text
- **No replace feature**: Only add/remove/set default operations

### API Behavior
- **Soft delete only**: Never hard delete, set is_active: false
- **Default management**: Dedicated endpoint that unsets all others
- **List endpoint**: Returns all records with status field
- **User can delete**: Even if it's their only payment method