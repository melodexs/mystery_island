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

    while True:
        won = explore()

        if won:
            print("The rescue boat has arrived")
            break

def collect_item():
    if "torch" in inventory:
        print("You already have a torch!")
    else:
        print("You found a torch!")
        inventory.append("torch")

    print("Your inventory:", inventory)


def collect_key():
    if "key" in inventory:
        print("You already have the key!")
    else:
        print("You found the Lighthouse key!")
        inventory.append("key")

    print("Your inventory:", inventory)


def cross_bridge():
    if "key" in inventory:
        print("The bridge unlocks! You can cross.")
        won = enter_lighthouse()
        return won
        
    else:
        print("The bridge is locked. Find the key first!")
        return False

def enter_lighthouse():
    if "key" in inventory and "torch" in inventory:
        print("You enter the lighthouse. You restore the beacon. YOU WIN!")
        return True

    else:
        print("You need the key and torch before entering!")
        return False

def explore():
    print("\nWhere would you like to explore?")
    print("1. Beach")
    print("2. Jungle")
    print("3. Bridge")

    location = input("Choose a location: ")

    if location == "1":
        print("\nYou are exploring the Beach.")
        collect_item()

    elif location == "2":
        print("\nYou are exploring the Jungle.")
        collect_key()

    elif location == "3":
        won = cross_bridge()
        return won 

    else:
        print("Invalid location!")
        return False


while True:
    show_menu()

    choice = input("Choose an option: ")

    if choice == "1":
        start_game()
        won = explore()

        if won:
            print("The rescue boat has arrived!")
            break

    elif choice == "2":
        print("Goodbye!")
        break

    else:
        print("Invalid choice! Try again.")