inventory = []


def show_menu():
    print("\n=== THE LOST LIGHTHOUSE ===")
    print("1. Start game")
    print("2. Quit")


def start_game():
    print("\nYou wake up on a strange island.")
    print("Waves crash against the shore.")
    print("You are standing on the beach.")
    print("You see a forest ahead.")


def collect_item():
    print("\nYou found a torch!")
    inventory.append("torch")
    print("Your inventory:", inventory)


def explore():
    print("\nWhere would you like to explore?")
    print("1. Beach")
    print("2. Jungle")

    location = input("Choose a location: ")

    if location == "1":
        print("You are exploring the Beach.")
        collect_item()

    elif location == "2":
        print("You are exploring the Jungle.")

    else:
        print("Invalid location!")


while True:
    show_menu()

    choice = input("Choose an option: ")

    if choice == "1":
        start_game()
        explore()

    elif choice == "2":
        print("Goodbye!")
        break

    else:
        print("Invalid choice! Try again.")