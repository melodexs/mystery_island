def show_menu():
    print("\n=== THE LOST LIGHTHOUSE ===")
    print("1. start game")
    print("2. quit")

while True:
    
    show_menu()

    choice = input("choose an option: ")

    if choice == "1":
        print("welcome to Mystrey Island")
        print("Your boat has crashed during a storm.")
    elif choice == "2":
        print("Goodbye!")
        break
        
    else:
        print("Invalid choice! Try again.")
