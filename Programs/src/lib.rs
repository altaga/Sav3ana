use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::next_account_info,
    account_info::AccountInfo,
    borsh0_10::try_from_slice_unchecked,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey,
    pubkey::Pubkey,
    system_instruction::{create_account, transfer},
    sysvar::{rent::Rent, Sysvar},
};

use spl_token::instruction;

use spl_associated_token_account::get_associated_token_address;

// Transactions Data Processing

#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub struct TransactionData {
    instruction: u8,
    bump: u8,
    owner: [u8; 32],
    amount: u64,
    concept: String,
}

// Create Card Processing

#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub struct CreateData {
    instruction: u8,
    bump: u8,
    space: u8,
    owner: [u8; 32],
    nfc: bool,
    types: bool,
    kind: u8,
    brand: u8,
}
// Card PDA Data

#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub struct CardPDADataBorsh {
    owner: [u8; 32],
    nfc: bool,   // Activate or Deactivate
    types: bool, // Physical or Virtual
    kind: u8,    // 0 = Debit, 1= Credit, 2=Prepaid, etc
    brand: u8,   // 0 = VISA, 1 = MASTERCARD, 2 = AMEX, etc
}

// Card Enum Settings

pub enum CardInstruction {
    // Create Card
    CreateCard(CreateData),
    ChangeInfo(CreateData),
    // Transactions
    Purchase(TransactionData),
    PurchaseToken(TransactionData),
}

impl CardInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let selector = input.clone();
        Ok(match selector[0] {
            0 => Self::CreateCard(CreateData::deserialize(&mut input.clone()).unwrap()),
            1 => Self::ChangeInfo(CreateData::deserialize(&mut input.clone()).unwrap()),
            2 => Self::Purchase(TransactionData::deserialize(&mut input.clone()).unwrap()),
            3 => Self::PurchaseToken(TransactionData::deserialize(&mut input.clone()).unwrap()),
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

// Entry point is a function call process_instruction
entrypoint!(process_instruction);
static OWNER: Pubkey = pubkey!("8MwdDuw66kKisAVmh6RjiP8QDMckUkM71fSGCC6c8vCH");

// Entry Point

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = CardInstruction::unpack(instruction_data)?;
    // Match against the data struct returned into `instruction` variable
    match instruction {
        CardInstruction::CreateCard(x) => {
            msg!("Create Card with data: {:?}", x);
            create_card(program_id, accounts, x)?;
        }
        CardInstruction::ChangeInfo(x) => {
            msg!("Change Card with data: {:?}", x);
            change_card(program_id, accounts, x)?;
        }
        CardInstruction::Purchase(x) => {
            msg!("Purchase Transaction: {:?}", x);
            transfer_from_card(program_id, accounts, x)?;
        }
        CardInstruction::PurchaseToken(x) => {
            msg!("Purchase Transaction: {:?}", x);
            transfer_from_card_token(program_id, accounts, x)?;
        }
    }
    Ok(())
}

// Validations

fn validate(acc1: &AccountInfo, acc2: &Pubkey) -> ProgramResult {
    if !acc1.is_signer || acc2 != acc1.key {
        return Err(ProgramError::IllegalOwner);
    }
    Ok(())
}

// Create Card

fn create_card(program_id: &Pubkey, accounts: &[AccountInfo], data: CreateData) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer_account_info = next_account_info(account_info_iter)?;
    let pda_account_info = next_account_info(account_info_iter)?;
    let rent_sysvar_account_info = &Rent::from_account_info(next_account_info(account_info_iter)?)?;
    let system_program = next_account_info(account_info_iter)?;
    // Validation
    validate(
        payer_account_info,
        &Pubkey::new_from_array(data.owner.clone()),
    )?;
    // find space and minimum rent required for account
    let data_size = data.space;
    let bump = data.bump;

    let signers_seeds: &[&[u8]; 3] = &[b"card", &data.owner, &[bump.clone()]];

    let pda = Pubkey::create_program_address(signers_seeds, program_id)?;

    if pda.ne(&pda_account_info.key) {
        return Err(ProgramError::InvalidAccountData);
    }

    let rent_lamports = rent_sysvar_account_info.minimum_balance(data_size.into());

    let create_account_ix = create_account(
        &payer_account_info.key,
        &pda_account_info.key,
        rent_lamports,
        data_size.into(),
        program_id,
    );

    invoke_signed(
        &create_account_ix,
        &[
            payer_account_info.clone(),
            pda_account_info.clone(),
            system_program.clone(),
        ],
        &[signers_seeds],
    )?;

    msg!("unpacking state account");
    let mut card_data =
        try_from_slice_unchecked::<CardPDADataBorsh>(&pda_account_info.data.borrow()).unwrap();

    msg!("{:?}", card_data);

    card_data.kind = data.kind;
    card_data.nfc = data.nfc;
    card_data.owner = data.owner;
    card_data.types = data.types;
    card_data.brand = data.brand;

    msg!("{:?}", card_data);
    card_data.serialize(&mut &mut pda_account_info.data.borrow_mut()[..])?;

    Ok(())
}

// Get info - Read Cost

fn change_card(program_id: &Pubkey, accounts: &[AccountInfo], data: CreateData) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer_account_info = next_account_info(account_info_iter)?;
    let pda_account_info = next_account_info(account_info_iter)?;
    // Validation
    validate(
        payer_account_info,
        &Pubkey::new_from_array(data.owner.clone()),
    )?;
    // find space and minimum rent required for account
    let _space = data.space;
    let bump = data.bump;

    let signers_seeds: &[&[u8]; 3] = &[b"card", &data.owner, &[bump.clone()]];

    let pda = Pubkey::create_program_address(signers_seeds, program_id)?;

    if pda.ne(&pda_account_info.key) {
        return Err(ProgramError::InvalidAccountData);
    }

    msg!("unpacking state account");
    let mut card_data =
        try_from_slice_unchecked::<CardPDADataBorsh>(&pda_account_info.data.borrow()).unwrap();

    msg!("{:?}", card_data);

    card_data.nfc = data.nfc;
    card_data.owner = data.owner;
    card_data.kind = data.kind;
    card_data.types = data.types;
    card_data.brand = data.brand;

    msg!("{:?}", card_data);
    card_data.serialize(&mut &mut pda_account_info.data.borrow_mut()[..])?;

    Ok(())
}

// Transfer from Card

fn transfer_from_card(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: TransactionData,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer_account_info = next_account_info(account_info_iter)?;
    let pda_account_info = next_account_info(account_info_iter)?;
    let to_account_info = next_account_info(account_info_iter)?;
    // Validation
    validate(payer_account_info, &OWNER)?;
    // find space and minimum rent required for account
    let bump = &data.bump;

    let signers_seeds: &[&[u8]; 3] = &[b"card", &data.owner, &[bump.clone()]];

    let pda = Pubkey::create_program_address(signers_seeds, program_id)?;

    if pda.ne(&pda_account_info.key) {
        return Err(ProgramError::InvalidAccountData);
    }

    // Does the from account have enough lamports to transfer?
    if **pda_account_info.try_borrow_lamports()? < data.amount {
        return Err(ProgramError::InsufficientFunds);
    }
    // Debit from_account and credit to_account
    **pda_account_info.try_borrow_mut_lamports()? -= data.amount;
    **to_account_info.try_borrow_mut_lamports()? += data.amount;

    Ok(())
}

// Transfer Token from Card

fn transfer_from_card_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: TransactionData,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer = next_account_info(account_info_iter)?; // Assuming a payer for fees
    let pda_account_info = next_account_info(account_info_iter)?;
    let token_source = next_account_info(account_info_iter)?; // Source token account
    let token_destination = next_account_info(account_info_iter)?; // Destination token account
    let token_program = next_account_info(account_info_iter)?; // SPL Token program ID
    let program_id_info = next_account_info(account_info_iter)?; // SPL Token program ID

    let bump = &data.bump;
    let signers_seeds: &[&[u8]; 3] = &[b"card", &data.owner, &[bump.clone()]];
    let pda = Pubkey::create_program_address(signers_seeds, program_id)?;
    if pda.ne(&pda_account_info.key) {
        return Err(ProgramError::InvalidAccountData);
    }

    invoke_signed(
        &instruction::transfer(
            &token_program.key,
            &token_source.key,
            &token_destination.key,
            &pda_account_info.key,
            &[&pda],
            data.amount.clone(),
        )?,
        &[
            program_id_info.clone(),
            payer.clone(),
            pda_account_info.clone(),
            token_source.clone(),
            token_destination.clone(),
        ],
        &[signers_seeds],
    );

    Ok(())
}
