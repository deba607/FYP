import sys
from chatbot.booking_handler import BookingHandler

def run_tests():
    handler = BookingHandler()
    
    test_cases = [
        ("two tickets one for adult and one for child", {"Adult": 1, "Child": 1}),
        ("2 adults and 1 child", {"Adult": 2, "Child": 1}),
        ("one senior citizen, three students", {"Senior Citizen": 1, "Student": 3}),
        ("adult 2 child 1", {"Adult": 2, "Child": 1}),
        ("1 researcher, 2 students", {"Researcher/Scientist": 1, "Student": 2}),
        ("2 tickets for adults", {"Adult": 2}),
        ("two for kids", {"Child": 2}),
        ("adults: 2, children: 3", {"Adult": 2, "Child": 3}),
        ("I want to book three students", {"Student": 3}),
        ("just one senior", {"Senior Citizen": 1}),
        ("adult and child", {"Adult": 1, "Child": 1}),
    ]
    
    passed = 0
    for idx, (text, expected) in enumerate(test_cases, 1):
        result = handler.parse_multiple_visitor_types(text)
        if result == expected:
            print(f"Test {idx} PASSED: '{text}' -> {result}")
            passed += 1
        else:
            print(f"Test {idx} FAILED: '{text}' -> Got {result}, Expected {expected}")
            
    print(f"\n{passed}/{len(test_cases)} tests passed.")
    if passed == len(test_cases):
        print("SUCCESS!")
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
